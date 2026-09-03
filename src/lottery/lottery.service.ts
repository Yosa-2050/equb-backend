import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Repository } from 'typeorm';
import { EqubService } from '../equb/equb.service';
import { groupLabel } from '../equb/collab-group.util';
import {
  CollabRole,
  EqubMember,
  EqubMemberAssignmentSource,
} from '../equb/entities/equb-member.entity';
import { periodLabel } from '../common/period-label';
import { displayNameOf } from '../users/user-display.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { TranslationService } from '../i18n/translation.service';
import { LotteryGateway } from './lottery.gateway';
import { AdminPickDto } from './dto/admin-pick.dto';

export interface DrawResultDto {
  memberId: string;
  number: number;
  fullName: string;
  telegramUsername: string;
  month: number | null;
  assignmentSource: EqubMemberAssignmentSource | null;
  isGroup?: boolean;
  groupMembers?: { memberId: string; fullName: string }[];
}


function buildUnits(members: EqubMember[]): EqubMember[][] {
  const seen = new Set<string>();
  const units: EqubMember[][] = [];
  for (const m of members) {
    if (m.collabGroupId) {
      if (seen.has(m.collabGroupId)) continue;
      seen.add(m.collabGroupId);
      units.push(members.filter((x) => x.collabGroupId === m.collabGroupId));
    } else {
      units.push([m]);
    }
  }
  return units;
}

function unitLeader(unit: EqubMember[]): EqubMember {
  return unit.find((m) => m.collabRole === CollabRole.LEADER) ?? unit[0];
}

function unitToResult(unit: EqubMember[], number: number): DrawResultDto {
  const leader = unitLeader(unit);
  const isGroup = unit.length > 1;
  return {
    memberId: leader.id,
    number,
    fullName: isGroup ? groupLabel(unit) : displayNameOf(leader.user),
    telegramUsername: leader.user.telegramUsername,
    month: leader.order,
    assignmentSource: leader.assignmentSource,
    isGroup,
    groupMembers: isGroup
      ? unit.map((m) => ({ memberId: m.id, fullName: displayNameOf(m.user) }))
      : undefined,
  };
}

@Injectable()
export class LotteryService {
  constructor(
    @InjectRepository(EqubMember)
    private readonly equbMemberRepository: Repository<EqubMember>,
    private readonly equbService: EqubService,
    private readonly notificationsService: NotificationsService,
    private readonly lotteryGateway: LotteryGateway,
    private readonly configService: ConfigService,
    private readonly translationService: TranslationService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}


  async announce(equbId: string): Promise<{ notifiedCount: number }> {
    const equb = await this.equbService.findOne(equbId);
    const members = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });
    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    const link = `${miniAppUrl}/Equb/${equbId}/lottery`;

    await Promise.all(
      members.map(async (m) => {
        await this.notificationsService.create({
          userId: m.userId,
          title: 'Live Lottery Starting',
          description: `The live draw for ${equb.name} is starting now — join in!`,
          type: NotificationType.INFO,
          equbId,
        });

        if (miniAppUrl && m.user?.telegramId) {
          try {
            await this.bot.telegram.sendMessage(
              m.user.telegramId,
              this.translationService.t(m.user.language, 'lottery.announce', {
                equbName: equb.name,
              }),
              Markup.inlineKeyboard([
                Markup.button.webApp(
                  this.translationService.t(m.user.language, 'button.viewLive'),
                  link,
                ),
              ]),
            );
          } catch {
            // Best-effort; user may have blocked the bot.
          }
        }
      }),
    );

    return { notifiedCount: members.length };
  }

  async getDraws(equbId: string): Promise<{
    total: number;
    drawn: number;
    allDrawn: boolean;
    results: DrawResultDto[];
  }> {
    const members = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
      order: { order: 'ASC' },
    });
    const units = buildUnits(members.filter((m) => m.user));
    const results: DrawResultDto[] = units.map((unit, index) =>
      unitToResult(unit, index + 1),
    );
    const drawn = results.filter((r) => r.month !== null).length;
    return {
      total: results.length,
      drawn,
      allDrawn: drawn === results.length,
      results,
    };
  }

  async spin(equbId: string): Promise<DrawResultDto> {
    const members = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });

    if (members.length === 0) {
      throw new BadRequestException('This equb has no members to draw');
    }

    const units = buildUnits(members);
    const undrawnUnits = units.filter((u) => u[0].order === null);
    if (undrawnUnits.length === 0) {
      throw new BadRequestException('All members already have an equb month');
    }

    const assignedOrders = new Set(
      members.filter((m) => m.order !== null).map((m) => m.order!),
    );
    let nextMonth = 1;
    while (assignedOrders.has(nextMonth)) {
      nextMonth += 1;
    }

    const winnerUnit = undrawnUnits[Math.floor(Math.random() * undrawnUnits.length)];
    for (const m of winnerUnit) {
      m.order = nextMonth;
      m.hasWon = true;
      m.assignmentSource = EqubMemberAssignmentSource.LOTTERY;
    }
    const saved = await this.equbMemberRepository.save(winnerUnit);
    const leader = unitLeader(saved);
    const isGroup = saved.length > 1;

    const equb = await this.equbService.findOne(equbId);
    await Promise.all(
      saved.map((m) => {
        const period = this.translationService.periodWord(
          m.user.language,
          equb.frequency,
        );
        const key = !isGroup
          ? 'lottery.won.solo'
          : m.id === leader.id
            ? 'lottery.won.leader'
            : 'lottery.won.member';
        return this.notificationsService.create({
          userId: m.userId,
          title: this.translationService.t(m.user.language, 'lottery.won.title'),
          description: this.translationService.t(m.user.language, key, {
            equbName: equb.name,
            period,
            round: nextMonth,
            leaderName: displayNameOf(leader.user),
          }),
          type: NotificationType.SUCCESS,
          equbId,
        });
      }),
    );


    const result = unitToResult(saved, nextMonth);

    this.lotteryGateway.broadcastSpin(equbId, result);

    if (undrawnUnits.length === 1) {
      await this.notifyScheduleComplete(equbId, equb.name);
    }

    return result;
  }

  async adminPick(
    equbId: string,
    actorId: string,
    dto: AdminPickDto,
  ): Promise<DrawResultDto> {
    const equb = await this.equbService.findOne(equbId);
    const members = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });
    if (members.some((m) => m.order !== null)) {
      throw new BadRequestException(
        "Admin's pick can only be set before the lottery draw starts",
      );
    }

    const selected = members.find((m) => m.id === dto.memberId);
    if (!selected) {
      throw new NotFoundException('Member not found in this equb');
    }

    const unit = selected.collabGroupId
      ? members.filter((m) => m.collabGroupId === selected.collabGroupId)
      : [selected];

    for (const m of unit) {
      m.order = 1;
      m.hasWon = true;
      m.assignmentSource = EqubMemberAssignmentSource.ADMIN_PICK;
    }

    const saved = await this.equbMemberRepository.save(unit);
    const result = unitToResult(saved, 1);
    const adminName = equb.admin ? displayNameOf(equb.admin) : 'Admin';
    const recipientName = result.fullName;
    await this.broadcastToMembers(
      equbId,
      "Admin's Pick",
      `Admin ${adminName} has assigned ${recipientName} to ${periodLabel(equb.frequency)} 1.`,
      NotificationType.INFO,
    );
    return result;
  }

  private async broadcastToMembers(
    equbId: string,
    title: string,
    description: string,
    type: NotificationType,
  ): Promise<void> {
    const members = await this.equbMemberRepository.find({ where: { equbId } });
    await Promise.all(
      members.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          title,
          description,
          type,
          equbId,
        }),
      ),
    );
  }

  private async notifyScheduleComplete(
    equbId: string,
    equbName: string,
  ): Promise<void> {
    const equb = await this.equbService.findOne(equbId);
    const label = periodLabel(equb.frequency);
    const finalMembers = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
      order: { order: 'ASC' },
    });
    const finalUnits = buildUnits(finalMembers.filter((m) => m.user));
    const schedule = finalUnits
      .map((unit) => {
        const leader = unitLeader(unit);
        const who = unit.length > 1 ? groupLabel(unit) : displayNameOf(leader.user);
        return `${label} ${leader.order}: ${who}`;
      })
      .join('\n');
    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    const link = `${miniAppUrl}/Equb/${equbId}/lottery`;

    await Promise.all(
      finalMembers.map(async (m) => {
        await this.notificationsService.create({
          userId: m.userId,
          title: this.translationService.t(m.user.language, 'lottery.complete.title'),
          description: `The draw for ${equbName} is complete!\n${schedule}`,
          type: NotificationType.SUCCESS,
          equbId,
        });

        if (miniAppUrl && m.user?.telegramId) {
          try {
            await this.bot.telegram.sendMessage(
              m.user.telegramId,
              this.translationService.t(m.user.language, 'lottery.complete'),
              Markup.inlineKeyboard([
                Markup.button.webApp(
                  this.translationService.t(m.user.language, 'button.viewResults'),
                  link,
                ),
              ]),
            );
          } catch {
            // Best-effort; user may have blocked the bot.
          }
        }
      }),
    );

    this.lotteryGateway.broadcastComplete(
      equbId,
      finalUnits.map((unit, index) => unitToResult(unit, index + 1)),
    );
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Repository } from 'typeorm';
import { EqubService } from '../equb/equb.service';
import { groupLabel } from '../equb/collab-group.util';
import { CollabRole, EqubMember } from '../equb/entities/equb-member.entity';
import { periodLabel } from '../common/period-label';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { LotteryGateway } from './lottery.gateway';

export interface DrawResultDto {
  memberId: string;
  number: number;
  fullName: string;
  telegramUsername: string;
  month: number | null;
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
    memberId: leader.userId,
    number,
    fullName: isGroup ? groupLabel(unit) : leader.user.fullName,
    telegramUsername: leader.user.telegramUsername,
    month: leader.order,
    isGroup,
    groupMembers: isGroup
      ? unit.map((m) => ({ memberId: m.userId, fullName: m.user.fullName }))
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
        });

        if (miniAppUrl && m.user?.telegramId) {
          try {
            await this.bot.telegram.sendMessage(
              m.user.telegramId,
              `🔴 Live lottery for ${equb.name} is starting now!`,
              Markup.inlineKeyboard([
                Markup.button.webApp('View Live', link),
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
    }
    const saved = await this.equbMemberRepository.save(winnerUnit);
    const leader = unitLeader(saved);
    const isGroup = saved.length > 1;

    const equb = await this.equbService.findOne(equbId);
    const label = periodLabel(equb.frequency);
    await Promise.all(
      saved.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          title: 'Lottery Winner Announced',
          description: isGroup
            ? `Your group won ${label.toLowerCase()} ${nextMonth} for ${equb.name}! ${
                m.id === leader.id
                  ? "You're the group leader — you'll collect and split the payout."
                  : `${leader.user.fullName} will collect and split it with you.`
              }`
            : `You won ${label.toLowerCase()} ${nextMonth} for ${equb.name}!`,
          type: NotificationType.SUCCESS,
        }),
      ),
    );


    const result = unitToResult(saved, nextMonth);

    this.lotteryGateway.broadcastSpin(equbId, result);

    if (undrawnUnits.length === 1) {
      await this.notifyScheduleComplete(equbId, equb.name);
    }

    return result;
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
        const who = unit.length > 1 ? groupLabel(unit) : leader.user.fullName;
        return `${label} ${leader.order}: ${who}`;
      })
      .join('\n');
    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    const link = `${miniAppUrl}/Equb/${equbId}/lottery`;

    await Promise.all(
      finalMembers.map(async (m) => {
        await this.notificationsService.create({
          userId: m.userId,
          title: 'Lottery Complete',
          description: `The draw for ${equbName} is complete!\n${schedule}`,
          type: NotificationType.SUCCESS,
        });

        if (miniAppUrl && m.user?.telegramId) {
          try {
            await this.bot.telegram.sendMessage(
              m.user.telegramId,
              'Tap below to view the full schedule in the app 👇',
              Markup.inlineKeyboard([
                Markup.button.webApp('View Results', link),
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

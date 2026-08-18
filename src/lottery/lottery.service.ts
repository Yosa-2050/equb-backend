import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { Repository } from 'typeorm';
import { EqubService } from '../equb/equb.service';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { LotteryGateway } from './lottery.gateway';

export interface DrawResultDto {
  memberId: string;
  number: number;
  fullName: string;
  telegramUsername: string;
  month: number | null;
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
    const results: DrawResultDto[] = members
      .filter((m) => m.user)
      .map((m, index) => ({
        memberId: m.userId,
        number: index + 1,
        fullName: m.user.fullName,
        telegramUsername: m.user.telegramUsername,
        month: m.order,
      }));
    const drawn = results.filter((r) => r.month !== null).length;
    return {
      total: results.length,
      drawn,
      allDrawn: drawn === results.length,
      results,
    };
  }

  // Spins once: assigns ONE random undrawn member the next free month (1..N).
  // Matches the frontend's single-spin wheel.
  async spin(equbId: string): Promise<DrawResultDto> {
    const members = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });

    if (members.length === 0) {
      throw new BadRequestException('This equb has no members to draw');
    }

    const undrawn = members.filter((m) => m.order === null);
    if (undrawn.length === 0) {
      throw new BadRequestException('All members already have an equb month');
    }

    const assignedOrders = new Set(
      members.filter((m) => m.order !== null).map((m) => m.order!),
    );
    let nextMonth = 1;
    while (assignedOrders.has(nextMonth)) {
      nextMonth += 1;
    }

    const winner = undrawn[Math.floor(Math.random() * undrawn.length)];
    winner.order = nextMonth;
    winner.hasWon = true;
    const saved = await this.equbMemberRepository.save(winner);

    const equb = await this.equbService.findOne(equbId);
    await this.notificationsService.create({
      userId: saved.userId,
      title: 'Lottery Winner Announced',
      description: `You won month ${nextMonth} for ${equb.name}!`,
      type: NotificationType.SUCCESS,
    });

    const result: DrawResultDto = {
      memberId: saved.userId,
      number: nextMonth, // month is the payout slot; frontend number = roster position
      fullName: saved.user.fullName,
      telegramUsername: saved.user.telegramUsername,
      month: saved.order!,
    };

    this.lotteryGateway.broadcastSpin(equbId, result);

    if (undrawn.length === 1) {
      // This was the last undrawn member: the whole schedule is now final.
      await this.notifyScheduleComplete(equbId, equb.name);
    }

    return result;
  }

  private async notifyScheduleComplete(
    equbId: string,
    equbName: string,
  ): Promise<void> {
    const finalMembers = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
      order: { order: 'ASC' },
    });
    const schedule = finalMembers
      .map((m) => `Month ${m.order}: ${m.user.fullName}`)
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
      finalMembers
        .filter((m) => m.user)
        .map((m, index) => ({
          memberId: m.userId,
          number: index + 1,
          fullName: m.user.fullName,
          telegramUsername: m.user.telegramUsername,
          month: m.order,
        })),
    );
  }
}

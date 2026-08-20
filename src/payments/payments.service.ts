import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { In, Repository } from 'typeorm';
import { EqubService } from '../equb/equb.service';
import { resolveRound } from '../equb/collab-group.util';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { Equb, EqubStatus, PaymentCollector } from '../equb/entities/equb.entity';
import { periodLabel } from '../common/period-label';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TranslationService } from '../i18n/translation.service';
import { Payment, PaymentStatus } from './entities/payment.entity';

const toNumber = (value: string | number): number => Number(value);

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(EqubMember)
    private readonly equbMemberRepository: Repository<EqubMember>,
    private readonly equbService: EqubService,
    private readonly notificationsService: NotificationsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly translationService: TranslationService,
    private readonly configService: ConfigService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  // A member's contribution for this equb: their own override if set,
  // otherwise the equb's flat monthly rate.
  private memberAmount(equb: { monthlyAmount: string | number }, member: EqubMember): number {
    return member.contributionAmount !== null
      ? toNumber(member.contributionAmount)
      : toNumber(equb.monthlyAmount);
  }

  // Returns the state of one equb month: who receives the pot (the lottery
  // winner for that month) and one payment row per other member.
  async getMonth(equbId: string, month: number, actorId: string) {
    const equb = await this.equbService.findOne(equbId);
    const defaultAmount = toNumber(equb.monthlyAmount);

    const memberships = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });

    const { recipient, payerMembers, groupMembers } = resolveRound(
      memberships,
      month,
    );


    const collectorMember =
      equb.collector === PaymentCollector.ADMIN
        ? (memberships.find((m) => m.userId === equb.adminId) ?? recipient)
        : recipient;

    // Ensure a payment row exists for every member who owes this month.
    const seen = await this.paymentRepository.find({ where: { month } });
    for (const member of payerMembers) {
      if (!seen.some((p) => p.equbMemberId === member.id)) {
        seen.push(
          await this.paymentRepository.save(
            this.paymentRepository.create({
              equbMemberId: member.id,
              recipientId: recipient?.id ?? null,
              month,
              amount: this.memberAmount(equb, member),
              status: PaymentStatus.PENDING,
            }),
          ),
        );
      }
    }

    const rows = seen
      .filter(
        (p) =>
          p.equbMemberId && payerMembers.some((m) => m.id === p.equbMemberId),
      )
      .map((p) => {
        const member = payerMembers.find((m) => m.id === p.equbMemberId)!;
        return {
          id: p.id,
          memberId: member.userId,
          fullName: member.user.fullName,
          telegramUsername: member.user.telegramUsername,
          amount: toNumber(p.amount),
          status: p.status,
          receiptDate: p.receiptDate,
          receiptImageUrl: p.receiptImageUrl ?? null,
        };
      })
      .sort((a, b) => (a.fullName < b.fullName ? -1 : 1));

    const paidRows = rows.filter((r) => r.status === PaymentStatus.PAID);

  
    let payoutSplit: {
      totalPot: number;
      leaderMemberId: string;
      splits: {
        memberId: string;
        fullName: string;
        contributionAmount: number;
        share: number;
      }[];
    } | null = null;
    if (groupMembers && groupMembers.some((m) => m.userId === actorId)) {
      const totalPot = defaultAmount * payerMembers.length;
      payoutSplit = {
        totalPot,
        leaderMemberId: recipient!.userId,
        splits: groupMembers.map((m) => {
          const contribution = toNumber(m.contributionAmount ?? 0);
          const share =
            defaultAmount > 0 ? (contribution / defaultAmount) * totalPot : 0;
          return {
            memberId: m.userId,
            fullName: m.user.fullName,
            contributionAmount: contribution,
            share,
          };
        }),
      };
    }

    const isCurrentRoundView = month === equb.currentRound;
    const isWinnerActor = recipient?.userId === actorId;
    const isAdminActor = equb.adminId === actorId;
    const canDecide = isCurrentRoundView
      ? equb.collector === PaymentCollector.ADMIN
        ? isAdminActor
        : isWinnerActor
      : isWinnerActor || isAdminActor;

    return {
      equbId,
      month,
      amount: defaultAmount,
      collector: equb.collector,
      isRecipient: isWinnerActor,
      canDecide,
      recipient: recipient?.user
        ? {
            memberId: recipient.userId,
            fullName: recipient.user.fullName,
            telegramUsername: recipient.user.telegramUsername,
            isGroup: !!groupMembers,
            account: {
              provider: collectorMember?.accountProvider ?? null,
              number: collectorMember?.accountNumber ?? null,
            },
          }
        : null,
      payoutSplit,
      collected: paidRows.reduce((sum, r) => sum + r.amount, 0),
      totalMembers: payerMembers.length,
      paidCount: paidRows.length,
      allCollected: paidRows.length === payerMembers.length,
      payments: rows,
    };
  }

  // A member submits a receipt for this month's contribution.
  async submit(
    equbId: string,
    actorId: string,
    dto: { amount?: number; receiptImageUrl?: string },
  ) {
    const equb = await this.equbService.findOne(equbId);
    const member = await this.equbMemberRepository.findOne({
      where: { equbId, userId: actorId },
      relations: ['user'],
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this equb');
    }

    const month = equb.currentRound;
    const memberships = await this.equbMemberRepository.find({
      where: { equbId },
    });
    const { recipient } = resolveRound(memberships, month);
    const defaultAmount = this.memberAmount(equb, member);

    let payment = await this.paymentRepository.findOne({
      where: { equbMemberId: member.id, month },
    });
    if (!payment) {
      payment = this.paymentRepository.create({
        equbMemberId: member.id,
        recipientId: recipient?.id ?? null,
        month,
        amount: defaultAmount,
        status: PaymentStatus.PENDING,
      });
    }

    payment.amount = dto.amount ? toNumber(dto.amount) : defaultAmount;
    payment.status = PaymentStatus.PENDING;
    payment.receiptDate = new Date().toISOString().slice(0, 10);
    payment.rejectReason = null;
    if (dto.receiptImageUrl) {
      payment.receiptImageUrl = dto.receiptImageUrl;
    }
    return this.paymentRepository.save(payment);
  }

  async submitWithReceipt(
    equbId: string,
    actorId: string,
    file: Express.Multer.File | undefined,
    amount: number | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Receipt image is required');
    }
    const receiptImageUrl = await this.cloudinaryService.uploadBuffer(
      file.buffer,
    );
    return this.submit(equbId, actorId, { amount, receiptImageUrl });
  }

  async approve(paymentId: string, actorId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: [
        'equbMember',
        'equbMember.user',
        'recipient',
        'recipient.user',
      ],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const equb = await this.equbService.findOne(payment.equbMember.equbId);
    this.assertCanDecide(payment, actorId, equb);
    payment.status = PaymentStatus.PAID;
    payment.rejectReason = null;
    const saved = await this.paymentRepository.save(payment);

    await this.notificationsService.create({
      userId: payment.equbMember.userId,
      title: 'Payment Approved',
      description: `Your payment of ${toNumber(payment.amount)} ETB for ${equb.name} was approved.`,
      type: NotificationType.SUCCESS,
    });

    // Only the live round auto-advances the equb. Clearing a LATE debt in a
    // past, already-advanced round must never push currentRound forward again.
    if (
      payment.month === equb.currentRound &&
      (await this.isMonthFullyCollected(equb.id, payment.month))
    ) {
      const updated = await this.equbService.advanceRound(equb.id);
      await this.notifyRoundAdvanced(updated, payment.month);
    }

    return saved;
  }

  // Whether every payer for this month has a PAID payment row.
  private async isMonthFullyCollected(
    equbId: string,
    month: number,
  ): Promise<boolean> {
    const memberships = await this.equbMemberRepository.find({
      where: { equbId },
    });
    const { payerMembers } = resolveRound(memberships, month);
    if (payerMembers.length === 0) return false;

    const payments = await this.paymentRepository.find({
      where: { month, equbMemberId: In(payerMembers.map((m) => m.id)) },
    });
    return payerMembers.every((m) =>
      payments.some(
        (p) => p.equbMemberId === m.id && p.status === PaymentStatus.PAID,
      ),
    );
  }

  private async notifyRoundAdvanced(
    equb: Equb,
    completedMonth: number,
  ): Promise<void> {
    const members = await this.equbMemberRepository.find({
      where: { equbId: equb.id },
    });
    const label = periodLabel(equb.frequency);
    const isComplete = equb.status === EqubStatus.COMPLETED;
    await Promise.all(
      members.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          title: isComplete ? 'Equb Complete' : `${label} Complete`,
          description: isComplete
            ? `${equb.name} has finished all ${equb.durationMonths} ${label.toLowerCase()}s. Thanks for participating!`
            : `${label} ${completedMonth} has ended for ${equb.name}. ${label} ${equb.currentRound} has started.`,
          type: NotificationType.SUCCESS,
        }),
      ),
    );
  }

  async reject(paymentId: string, actorId: string, reason?: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: [
        'equbMember',
        'equbMember.user',
        'recipient',
        'recipient.user',
      ],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const equb = await this.equbService.findOne(payment.equbMember.equbId);
    this.assertCanDecide(payment, actorId, equb);
    payment.status = PaymentStatus.REJECTED;
    payment.rejectReason = reason ?? null;
    const saved = await this.paymentRepository.save(payment);

    await this.notificationsService.create({
      userId: payment.equbMember.userId,
      title: 'Payment Rejected',
      description: reason
        ? `Your payment receipt for ${equb.name} was rejected: ${reason}`
        : `Your payment receipt for ${equb.name} was rejected.`,
      type: NotificationType.WARNING,
    });
    return saved;
  }

  // Admin-triggered: reminds every member who hasn't paid this period yet,
  // telling them where to send the money (this period's recipient's account).
  async remind(equbId: string, actorId: string): Promise<{ remindedCount: number }> {
    await this.equbService.assertAdmin(equbId, actorId);
    return this.remindInternal(equbId);
  }

  // Core reminder logic, shared by the manual admin endpoint and the
  // automatic scheduler (which has no "actor" to authorize).
  async remindInternal(equbId: string): Promise<{ remindedCount: number }> {
    const equb = await this.equbService.findOne(equbId);
    const month = equb.currentRound;

    const memberships = await this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
    });
    const { recipient, payerMembers } = resolveRound(memberships, month);
    const collectorMember =
      equb.collector === PaymentCollector.ADMIN
        ? (memberships.find((m) => m.userId === equb.adminId) ?? recipient)
        : recipient;

    const payments = await this.paymentRepository.find({ where: { month } });
    const unpaid = payerMembers.filter((member) => {
      const payment = payments.find((p) => p.equbMemberId === member.id);
      return !payment || payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.REJECTED;
    });

    const accountInfo = collectorMember
      ? `${collectorMember.accountHolderName ?? collectorMember.user.fullName} — ${collectorMember.accountProvider ?? 'account'}: ${collectorMember.accountNumber ?? 'N/A'}`
      : 'the recipient (not yet drawn)';

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    const link = `${miniAppUrl}/Equb/${equbId}`;

    await Promise.all(
      unpaid.map(async (member) => {
        await this.notificationsService.create({
          userId: member.userId,
          title: this.translationService.t(member.user.language, 'reminder.title'),
          description: `Pay your ${this.memberAmount(equb, member)} ETB contribution for ${equb.name} (${periodLabel(equb.frequency).toLowerCase()} ${month}) to: ${accountInfo}`,
          type: NotificationType.WARNING,
        });

        if (miniAppUrl && member.user?.telegramId) {
          try {
            await this.bot.telegram.sendMessage(
              member.user.telegramId,
              this.translationService.t(member.user.language, 'reminder.due', {
                equbName: equb.name,
                period: this.translationService.periodWord(
                  member.user.language,
                  equb.frequency,
                ),
                round: month,
              }),
              Markup.inlineKeyboard([
                Markup.button.webApp(
                  this.translationService.t(member.user.language, 'button.uploadReceipt'),
                  link,
                ),
              ]),
            );
          } catch {
            // Best-effort; member may have blocked the bot.
          }
        }
      }),
    );

    return { remindedCount: unpaid.length };
  }

  // Time-driven: called by the scheduler once a period's deadline passes,
  // regardless of who has paid. Flags stragglers LATE instead of blocking
  // the group, then advances everyone to the next period.
  async forceAdvancePeriod(equbId: string): Promise<void> {
    const equb = await this.equbService.findOne(equbId);
    const month = equb.currentRound;

    const memberships = await this.equbMemberRepository.find({
      where: { equbId },
    });
    const { recipient, payerMembers } = resolveRound(memberships, month);

    const payments = await this.paymentRepository.find({ where: { month } });
    for (const member of payerMembers) {
      const existing = payments.find((p) => p.equbMemberId === member.id);
      if (existing) {
        if (existing.status !== PaymentStatus.PAID) {
          existing.status = PaymentStatus.LATE;
          await this.paymentRepository.save(existing);
        }
      } else {
        await this.paymentRepository.save(
          this.paymentRepository.create({
            equbMemberId: member.id,
            recipientId: recipient?.id ?? null,
            month,
            amount: this.memberAmount(equb, member),
            status: PaymentStatus.LATE,
          }),
        );
      }
    }

    const updated = await this.equbService.advanceRound(equbId);
    await this.notifyRoundAdvanced(updated, month);
  }


  private assertCanDecide(payment: Payment, actorId: string, equb: Equb): void {
    const isWinner = payment.recipient?.userId === actorId;
    const isAdmin = equb.adminId === actorId;
    const isCurrentRound = payment.month === equb.currentRound;

    const allowed = isCurrentRound
      ? equb.collector === PaymentCollector.ADMIN
        ? isAdmin
        : isWinner
      : isWinner || isAdmin;

    if (!allowed) {
      throw new ForbiddenException(
        equb.collector === PaymentCollector.ADMIN
          ? 'Only the equb admin can approve or reject payments'
          : 'Only the month recipient or the equb admin can approve or reject payments',
      );
    }
    if (payment.equbMember?.userId === actorId) {
      throw new BadRequestException('You cannot approve your own payment');
    }
  }
}

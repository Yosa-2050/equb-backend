import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EqubService } from '../equb/equb.service';
import { resolveRound } from '../equb/collab-group.util';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { Equb, EqubStatus } from '../equb/entities/equb.entity';
import { periodLabel } from '../common/period-label';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
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

    return {
      equbId,
      month,
      amount: defaultAmount,
      isRecipient: recipient?.userId === actorId,
      recipient: recipient?.user
        ? {
            memberId: recipient.userId,
            fullName: recipient.user.fullName,
            telegramUsername: recipient.user.telegramUsername,
            isGroup: !!groupMembers,
            account: {
              provider: recipient.accountProvider,
              number: recipient.accountNumber,
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
  async submit(equbId: string, actorId: string, dto: { amount?: number }) {
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
    return this.paymentRepository.save(payment);
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
    this.assertCanDecide(payment, actorId);
    payment.status = PaymentStatus.PAID;
    payment.rejectReason = null;
    const saved = await this.paymentRepository.save(payment);

    const equb = await this.equbService.findOne(payment.equbMember.equbId);
    await this.notificationsService.create({
      userId: payment.equbMember.userId,
      title: 'Payment Approved',
      description: `Your payment of ${toNumber(payment.amount)} ETB for ${equb.name} was approved.`,
      type: NotificationType.SUCCESS,
    });

    if (await this.isMonthFullyCollected(equb.id, payment.month)) {
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
    this.assertCanDecide(payment, actorId);
    payment.status = PaymentStatus.REJECTED;
    payment.rejectReason = reason ?? null;
    const saved = await this.paymentRepository.save(payment);

    const equb = await this.equbService.findOne(payment.equbMember.equbId);
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

    const payments = await this.paymentRepository.find({ where: { month } });
    const unpaid = payerMembers.filter((member) => {
      const payment = payments.find((p) => p.equbMemberId === member.id);
      return !payment || payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.REJECTED;
    });

    const accountInfo = recipient
      ? `${recipient.accountHolderName ?? recipient.user.fullName} — ${recipient.accountProvider ?? 'account'}: ${recipient.accountNumber ?? 'N/A'}`
      : 'the recipient (not yet drawn)';

    await Promise.all(
      unpaid.map((member) =>
        this.notificationsService.create({
          userId: member.userId,
          title: 'Payment Reminder',
          description: `Pay your ${this.memberAmount(equb, member)} ETB contribution for ${equb.name} (${periodLabel(equb.frequency).toLowerCase()} ${month}) to: ${accountInfo}`,
          type: NotificationType.WARNING,
        }),
      ),
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

  // Only the recipient of the month may approve/reject, and they may not
  // decide on their own payment.
  private assertCanDecide(
    payment: Payment | null,
    actorId: string,
  ): asserts payment is Payment {
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.recipient?.userId !== actorId) {
      throw new ForbiddenException(
        'Only the month recipient can approve or reject payments',
      );
    }
    if (payment.equbMember?.userId === actorId) {
      throw new BadRequestException('You cannot approve your own payment');
    }
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { AdminUpdateMemberDto } from './dto/admin-update-member.dto';
import { CreateCollabGroupDto } from './dto/create-collab-group.dto';
import { CreateEqubDto } from './dto/create-equb.dto';
import { NotifyMembersDto } from './dto/notify-members.dto';
import { UpdateEqubDto } from './dto/update-equb.dto';
import { UpdateMyMembershipDto } from './dto/update-my-membership.dto';
import { groupLabel } from './collab-group.util';
import { CollabGroup } from './entities/collab-group.entity';
import { CollabRole, EqubMember, EqubMemberRole } from './entities/equb-member.entity';
import {
  Equb,
  EqubFrequency,
  EqubStatus,
  PaymentCollector,
} from './entities/equb.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

const toNumber = (value: string | number): number => Number(value);

export interface EqubSummary {
  id: string;
  name: string;
  monthlyAmount: number;
  totalAmount: number;
  durationMonths: number;
  frequency: EqubFrequency;
  maxMembers: number | null;
  inviteCode: string;
  status: EqubStatus;
  isPublic: boolean;
  admin: { id: string; fullName: string; telegramUsername: string };
  membersCount: number;
  isFull: boolean;
  createdAt: Date;
}

@Injectable()
export class EqubService {
  constructor(
    @InjectRepository(Equb)
    private readonly equbRepository: Repository<Equb>,
    @InjectRepository(EqubMember)
    private readonly equbMemberRepository: Repository<EqubMember>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CollabGroup)
    private readonly collabGroupRepository: Repository<CollabGroup>,
    private readonly notificationsService: NotificationsService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  async create(dto: CreateEqubDto, userId: string): Promise<Equb> {
    const equb = this.equbRepository.create({
      name: dto.name,
      monthlyAmount: dto.monthlyAmount,
      durationMonths: dto.durationMonths,
      totalAmount: dto.totalAmount,
      totalPot: toNumber(dto.monthlyAmount) * dto.durationMonths,
      frequency: dto.frequency ?? EqubFrequency.MONTHLY,
      collector: dto.collector ?? PaymentCollector.WINNER,
      maxMembers: dto.maxMembers ?? null,
      reminderTime: dto.reminderTime ?? null,
      reminderDayOfWeek: dto.reminderDayOfWeek ?? null,
      reminderDayOfMonth: dto.reminderDayOfMonth ?? null,
      periodStartedAt: new Date(),
      isPublic: dto.isPublic ?? true,
      description: dto.description,
      inviteCode: this.generateInviteCode(),
      adminId: userId,
    });
    const saved = await this.equbRepository.save(equb);
    await this.equbMemberRepository.save(
      this.equbMemberRepository.create({
        equbId: saved.id,
        userId,
        role: EqubMemberRole.ADMIN,
      }),
    );
    return saved;
  }

  async findAllPublic(): Promise<EqubSummary[]> {
    const equbs = await this.equbRepository.find({
      where: { isPublic: true, status: EqubStatus.ACTIVE },
      relations: ['admin', 'members'],
      order: { createdAt: 'DESC' },
    });
    return equbs.map((e) => this.summary(e));
  }

  async findMine(userId: string): Promise<EqubSummary[]> {
    const memberships = await this.equbMemberRepository.find({
      where: { userId },
      relations: ['equb', 'equb.admin', 'equb.members'],
    });
    return memberships
      .map((m) => m.equb)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((e) => this.summary(e));
  }

  async findOne(id: string): Promise<Equb> {
    const equb = await this.equbRepository.findOne({
      where: { id },
      relations: ['admin'],
    });
    if (!equb) {
      throw new NotFoundException('Equb not found');
    }
    return equb;
  }

  async findDetail(id: string, actorId: string) {
    const equb = await this.findOne(id);
    const memberships = await this.equbMemberRepository.find({
      where: { equbId: id },
      relations: ['user'],
      order: { order: 'ASC' },
    });
    const memberRows = memberships
      .filter((m) => m.user)
      .map((m, index) => ({
        id: m.id,
        number: index + 1,
        fullName: m.user.fullName,
        telegramUsername: m.user.telegramUsername,
        phone: m.user.phone,
        role: m.role,
        order: m.order,
        contributionAmount: m.contributionAmount
          ? toNumber(m.contributionAmount)
          : null,
        collabGroupId: m.collabGroupId,
        collabRole: m.collabRole,
        account: {
          provider: m.accountProvider,
          number: m.accountNumber,
          holderName: m.accountHolderName,
        },
      }));
    const adminMember = memberships.find(
      (m) => m.role === EqubMemberRole.ADMIN,
    );

    const groupsById = new Map<string, EqubMember[]>();
    for (const m of memberships) {
      if (!m.collabGroupId || !m.user) continue;
      const list = groupsById.get(m.collabGroupId) ?? [];
      list.push(m);
      groupsById.set(m.collabGroupId, list);
    }
    const collabGroups = [...groupsById.entries()].map(([groupId, gms]) => ({
      id: groupId,
      label: groupLabel(gms),
      leaderMemberId:
        gms.find((g) => g.collabRole === CollabRole.LEADER)?.id ?? gms[0].id,
      memberIds: gms.map((g) => g.id),
    }));
    return {
      id: equb.id,
      name: equb.name,
      monthlyAmount: toNumber(equb.monthlyAmount),
      totalPot: toNumber(equb.totalPot),
      totalAmount: toNumber(equb.totalAmount),
      durationMonths: equb.durationMonths,
      frequency: equb.frequency,
      collector: equb.collector,
      maxMembers: equb.maxMembers,
      reminderTime: equb.reminderTime,
      reminderDayOfWeek: equb.reminderDayOfWeek,
      reminderDayOfMonth: equb.reminderDayOfMonth,
      inviteCode: equb.inviteCode,
      status: equb.status,
      isPublic: equb.isPublic,
      description: equb.description,
      currentRound: equb.currentRound,
      nextDrawDate: equb.nextDrawDate,
      periodStartedAt: equb.periodStartedAt,
      createdAt: equb.createdAt,
      admin: {
        id: adminMember?.userId ?? equb.adminId,
        fullName: equb.admin?.fullName,
        telegramUsername: equb.admin?.telegramUsername,
      },
      isAdmin: !!adminMember && adminMember.userId === actorId,
      isMember: memberships.some((m) => m.userId === actorId),
      membersCount: memberRows.length,
      isFull: equb.maxMembers != null && memberRows.length >= equb.maxMembers,
      members: memberRows,
      collabGroups,
    };
  }

  async findByInviteCode(inviteCode: string): Promise<Equb> {
    const equb = await this.equbRepository.findOne({
      where: { inviteCode: inviteCode.toUpperCase() },
      relations: ['admin'],
    });
    if (!equb) {
      throw new NotFoundException('Equb not found for this invite link');
    }
    return equb;
  }

  async update(id: string, dto: UpdateEqubDto, actorId: string): Promise<Equb> {
    await this.assertAdmin(id, actorId);
    const equb = await this.findOne(id);
    equb.name = dto.name ?? equb.name;
    equb.isPublic = dto.isPublic ?? equb.isPublic;
    if (dto.description !== undefined) equb.description = dto.description;
    if (dto.monthlyAmount !== undefined) {
      equb.monthlyAmount = dto.monthlyAmount;
      equb.totalPot = toNumber(dto.monthlyAmount) * equb.durationMonths;
    }
    if (dto.durationMonths !== undefined) {
      equb.durationMonths = dto.durationMonths;
      equb.totalPot = toNumber(equb.monthlyAmount) * dto.durationMonths;
    }
    if (dto.totalAmount !== undefined) {
      equb.totalAmount = dto.totalAmount;
    }
    if (dto.frequency !== undefined) {
      equb.frequency = dto.frequency;
    }
    if (dto.collector !== undefined) {
      equb.collector = dto.collector;
    }
    if (dto.maxMembers !== undefined) {
      equb.maxMembers = dto.maxMembers;
    }
    if (dto.reminderTime !== undefined) {
      equb.reminderTime = dto.reminderTime;
    }
    if (dto.reminderDayOfWeek !== undefined) {
      equb.reminderDayOfWeek = dto.reminderDayOfWeek;
    }
    if (dto.reminderDayOfMonth !== undefined) {
      equb.reminderDayOfMonth = dto.reminderDayOfMonth;
    }
    return this.equbRepository.save(equb);
  }

  async close(id: string, actorId: string): Promise<Equb> {
    await this.assertAdmin(id, actorId);
    const equb = await this.findOne(id);
    equb.status = EqubStatus.COMPLETED;
    return this.equbRepository.save(equb);
  }

  // Moves to the next period (early if fully collected, or forced by the
  // scheduler once the period's deadline passes), or marks the equb
  // completed if that was the last one.
  async advanceRound(id: string): Promise<Equb> {
    const equb = await this.findOne(id);
    if (equb.currentRound >= equb.durationMonths) {
      equb.status = EqubStatus.COMPLETED;
    } else {
      equb.currentRound += 1;
      equb.periodStartedAt = new Date();
      equb.lastReminderSentAt = null;
    }
    return this.equbRepository.save(equb);
  }

  async remove(id: string, actorId: string): Promise<{ success: boolean }> {
    await this.assertAdmin(id, actorId);
    const members = await this.equbMemberRepository.find({
      where: { equbId: id },
    });
    const memberIds = members.map((m) => m.id);
    if (memberIds.length) {
      await this.paymentRepository.delete({ recipientId: In(memberIds) });
      await this.paymentRepository.delete({ equbMemberId: In(memberIds) });
    }
    await this.equbMemberRepository.delete({ equbId: id });
    await this.equbRepository.delete(id);
    return { success: true };
  }

  // Self-service edit: a member updates their own display name and payout
  // account details for this equb.
  async updateMyMembership(
    equbId: string,
    userId: string,
    dto: UpdateMyMembershipDto,
  ): Promise<EqubMember> {
    const member = await this.equbMemberRepository.findOne({
      where: { equbId, userId },
      relations: ['user'],
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this equb');
    }

    if (dto.fullName !== undefined || dto.phone !== undefined) {
      await this.userRepository.update(userId, {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      });
    }
    if (dto.accountProvider !== undefined) {
      member.accountProvider = dto.accountProvider;
    }
    if (dto.accountNumber !== undefined) {
      member.accountNumber = dto.accountNumber;
    }
    if (dto.accountHolderName !== undefined) {
      member.accountHolderName = dto.accountHolderName;
    }
    if (dto.contributionAmount !== undefined) {
      member.contributionAmount = dto.contributionAmount;
    }
    return this.equbMemberRepository.save(member);
  }

  // Admin edit: lets the admin fill in/correct any member's contact and
  // payout details, e.g. when a member never finished the bot's onboarding.
  async adminUpdateMember(
    equbId: string,
    memberId: string,
    actorId: string,
    dto: AdminUpdateMemberDto,
  ): Promise<EqubMember> {
    await this.assertAdmin(equbId, actorId);
    const member = await this.equbMemberRepository.findOne({
      where: { id: memberId, equbId },
      relations: ['user'],
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (dto.fullName !== undefined || dto.phone !== undefined) {
      await this.userRepository.update(member.userId, {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      });
    }
    if (dto.accountProvider !== undefined) {
      member.accountProvider = dto.accountProvider;
    }
    if (dto.accountNumber !== undefined) {
      member.accountNumber = dto.accountNumber;
    }
    if (dto.accountHolderName !== undefined) {
      member.accountHolderName = dto.accountHolderName;
    }
    if (dto.contributionAmount !== undefined) {
      member.contributionAmount = dto.contributionAmount;
    }
    return this.equbMemberRepository.save(member);
  }

  // Admin broadcast: a free-form announcement to every member (in-app + bot DM).
  async notifyMembers(
    equbId: string,
    actorId: string,
    dto: NotifyMembersDto,
  ): Promise<{ notifiedCount: number }> {
    await this.assertAdmin(equbId, actorId);
    const members = await this.equbMemberRepository.find({
      where: { equbId },
    });
    await Promise.all(
      members.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          title: dto.title,
          description: dto.message,
          type: NotificationType.INFO,
        }),
      ),
    );
    return { notifiedCount: members.length };
  }


  async createCollabGroup(
    equbId: string,
    actorId: string,
    dto: CreateCollabGroupDto,
  ): Promise<CollabGroup> {
    await this.assertAdmin(equbId, actorId);
    const equb = await this.findOne(equbId);

    const memberIds = dto.members.map((m) => m.memberId);
    if (new Set(memberIds).size !== memberIds.length) {
      throw new BadRequestException('Duplicate members in group');
    }
    if (!memberIds.includes(dto.leaderMemberId)) {
      throw new BadRequestException('Leader must be one of the group members');
    }

    const members = await this.equbMemberRepository.find({
      where: { id: In(memberIds), equbId },
    });
    if (members.length !== memberIds.length) {
      throw new NotFoundException('One or more members not found in this equb');
    }
    if (members.some((m) => m.collabGroupId)) {
      throw new BadRequestException(
        'One or more members already belong to a collab group',
      );
    }
    if (members.some((m) => m.order !== null)) {
      throw new BadRequestException(
        'Cannot group members who already have a drawn period',
      );
    }

    const sum = dto.members.reduce((s, m) => s + m.contributionAmount, 0);
    const target = toNumber(equb.monthlyAmount);
    if (Math.abs(sum - target) > 0.01) {
      throw new BadRequestException(
        `Contributions must sum to exactly ${target} ETB (got ${sum})`,
      );
    }

    const group = await this.collabGroupRepository.save(
      this.collabGroupRepository.create({ equbId, name: dto.name ?? null }),
    );

    for (const input of dto.members) {
      await this.equbMemberRepository.update(input.memberId, {
        collabGroupId: group.id,
        collabRole:
          input.memberId === dto.leaderMemberId
            ? CollabRole.LEADER
            : CollabRole.MEMBER,
        contributionAmount: input.contributionAmount,
      });
    }

    return group;
  }

  async dissolveCollabGroup(
    equbId: string,
    actorId: string,
    groupId: string,
  ): Promise<{ success: boolean }> {
    await this.assertAdmin(equbId, actorId);
    const group = await this.collabGroupRepository.findOne({
      where: { id: groupId, equbId },
    });
    if (!group) {
      throw new NotFoundException('Collab group not found');
    }

    await this.equbMemberRepository.update(
      { collabGroupId: groupId },
      { collabGroupId: null, collabRole: null, contributionAmount: null },
    );
    await this.collabGroupRepository.delete(groupId);
    return { success: true };
  }

  async removeMember(
    equbId: string,
    memberId: string,
    actorId: string,
  ): Promise<{ success: boolean }> {
    await this.assertAdmin(equbId, actorId);
    const member = await this.equbMemberRepository.findOne({
      where: { id: memberId, equbId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (member.role === EqubMemberRole.ADMIN) {
      throw new ForbiddenException('Cannot remove the equb admin');
    }
    await this.equbMemberRepository.delete({ id: member.id });
    return { success: true };
  }

  async join(equbId: string, userId: string): Promise<EqubMember> {
    const equb = await this.findOne(equbId);
    const existing = await this.equbMemberRepository.findOne({
      where: { equbId, userId },
    });
    if (existing) {
      return existing;
    }
    if (!equb.isPublic) {
      throw new ForbiddenException(
        'This is a private equb. Ask the admin to add you.',
      );
    }
    await this.assertNotFull(equb);
    const member = this.equbMemberRepository.create({
      equbId,
      userId,
      role: EqubMemberRole.MEMBER,
    });
    const saved = await this.equbMemberRepository.save(member);
    await this.notifyOnJoin(equb, userId);
    return saved;
  }

  // Joins via a Telegram invite link. Bypasses the private/public check because
  // possession of the invite link is what grants access.
  async joinByInvite(equbId: string, userId: string): Promise<EqubMember> {
    const equb = await this.findOne(equbId);
    const existing = await this.equbMemberRepository.findOne({
      where: { equbId, userId },
    });
    if (existing) {
      return existing;
    }
    await this.assertNotFull(equb);
    const member = this.equbMemberRepository.create({
      equbId,
      userId,
      role: EqubMemberRole.MEMBER,
    });
    const saved = await this.equbMemberRepository.save(member);
    await this.notifyOnJoin(equb, userId);
    return saved;
  }

  // Confirms the join to the new member and tells every existing member
  // (including the admin) who just joined.
  private async notifyOnJoin(
    equb: Equb,
    newMemberUserId: string,
  ): Promise<void> {
    const newMember = await this.userRepository.findOne({
      where: { id: newMemberUserId },
    });
    if (!newMember) return;

    await this.notificationsService.create({
      userId: newMemberUserId,
      title: 'Equb Joined',
      description: `You joined "${equb.name}". Welcome!`,
      type: NotificationType.SUCCESS,
    });

    // Prompt for payout info (phone/account) right away via the bot, since
    // notificationsService.create() only sends plain text, not buttons.
    if (newMember.telegramId) {
      try {
        await this.bot.telegram.sendMessage(
          newMember.telegramId,
          `One more thing — add your phone number and payout account for "${equb.name}" so we know where to send your month's payout.`,
          Markup.inlineKeyboard([
            Markup.button.callback('Add my payout info', `fillinfo:${equb.id}`),
          ]),
        );
      } catch {
        // Best-effort; user may have blocked the bot.
      }
    }

    const existingMembers = await this.equbMemberRepository.find({
      where: { equbId: equb.id },
    });
    const others = existingMembers.filter(
      (m) => m.userId !== newMemberUserId,
    );
    await Promise.all(
      others.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          title: 'New Member Joined',
          description: `${newMember.fullName} joined ${equb.name}.`,
          type: NotificationType.INFO,
        }),
      ),
    );
  }

  private async assertNotFull(equb: Equb): Promise<void> {
    if (equb.maxMembers == null) return;
    const count = await this.equbMemberRepository.count({
      where: { equbId: equb.id },
    });
    if (count >= equb.maxMembers) {
      throw new BadRequestException('This equb is full');
    }
  }

  async getMembers(equbId: string): Promise<EqubMember[]> {
    return this.equbMemberRepository.find({
      where: { equbId },
      relations: ['user'],
      order: { order: 'ASC' },
    });
  }

  async assertAdmin(equbId: string, userId: string): Promise<EqubMember> {
    const member = await this.equbMemberRepository.findOne({
      where: { equbId, userId, role: EqubMemberRole.ADMIN },
    });
    if (!member) {
      throw new ForbiddenException('Only the equb admin can do this');
    }
    return member;
  }

  private summary(equb: Equb): EqubSummary {
    const membersCount = Number(equb.members?.length ?? 0);
    return {
      id: equb.id,
      name: equb.name,
      monthlyAmount: toNumber(equb.monthlyAmount),
      totalAmount: toNumber(equb.totalAmount),
      durationMonths: equb.durationMonths,
      frequency: equb.frequency,
      maxMembers: equb.maxMembers,
      inviteCode: equb.inviteCode,
      status: equb.status,
      isPublic: equb.isPublic,
      admin: {
        id: equb.adminId,
        fullName: equb.admin?.fullName,
        telegramUsername: equb.admin?.telegramUsername,
      },
      membersCount,
      isFull: equb.maxMembers != null && membersCount >= equb.maxMembers,
      createdAt: equb.createdAt,
    };
  }

  private generateInviteCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EqubMember,
  EqubMemberRole,
} from '../equb/entities/equb-member.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(EqubMember)
    private readonly equbMemberRepository: Repository<EqubMember>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const memberships = await this.equbMemberRepository.find({
      where: { userId },
    });
    const createdEqubs = memberships.filter(
      (m) => m.role === EqubMemberRole.ADMIN,
    ).length;

    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.PAID },
      relations: ['equbMember'],
    });
    const totalSaved = payments
      .filter((p) => p.equbMember?.userId === userId)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      id: user.id,
      fullName: user.fullName,
      telegramUsername: user.telegramUsername,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      language: user.language,
      createdEqubs,
      joinedEqubs: memberships.length,
      totalSaved,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.usersService.update(userId, {
      fullName: dto.fullName,
      phone: dto.phone,
      language: dto.language,
    });
    return this.getProfile(userId);
  }
}

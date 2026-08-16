import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOrCreateByTelegramId(data: {
    telegramId: string;
    firstName?: string;
    fullName?: string;
    telegramUsername?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { telegramId: data.telegramId },
    });
    if (existing) {
      if (data.fullName) existing.fullName = data.fullName;
      if (data.telegramUsername) existing.telegramUsername = data.telegramUsername;
      if (data.avatarUrl) existing.avatarUrl = data.avatarUrl;
      return this.usersRepository.save(existing);
    }

    const { firstName, ...rest } = data;
    const fullName =
      data.fullName ?? firstName ?? data.telegramUsername ?? 'Telegram User';
    const user = this.usersRepository.create({ ...rest, fullName });
    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  // Public-safe roster: excludes phone/telegramId, which are personal
  // contact details other members have no reason to see.
  async findAll(): Promise<
    Pick<User, 'id' | 'fullName' | 'telegramUsername' | 'avatarUrl'>[]
  > {
    return this.usersRepository.find({
      select: ['id', 'fullName', 'telegramUsername', 'avatarUrl'],
      order: { createdAt: 'DESC' },
    });
  }
}

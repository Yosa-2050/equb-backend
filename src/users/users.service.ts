import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserLanguage } from './entities/user.entity';

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
    // Only applied when creating a brand-new user (e.g. from Telegram's
    // language_code on /start). Never overrides an existing user's choice.
    language?: UserLanguage;
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

    const { firstName, language, ...rest } = data;
    const fullName =
      data.fullName ?? firstName ?? data.telegramUsername ?? 'Telegram User';
    const user = this.usersRepository.create({
      ...rest,
      fullName,
      language: language ?? UserLanguage.AM,
    });
    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  // displayName is the only editable "name" field here — fullName stays
  // Telegram-sourced and is never touched by user/admin edits.
  async update(
    id: string,
    data: { displayName?: string; phone?: string; language?: UserLanguage },
  ): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.usersRepository.findOneOrFail({ where: { id } });
  }

  // Public-safe roster: excludes phone/telegramId, which are personal
  // contact details other members have no reason to see.
  async findAll(): Promise<
    Pick<User, 'id' | 'fullName' | 'displayName' | 'telegramUsername' | 'avatarUrl'>[]
  > {
    return this.usersRepository.find({
      select: ['id', 'fullName', 'displayName', 'telegramUsername', 'avatarUrl'],
      order: { createdAt: 'DESC' },
    });
  }
}

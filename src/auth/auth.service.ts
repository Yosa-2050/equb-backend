import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

export interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(initData: string): Promise<{ user: User; token: string }> {
    const data = this.validateInitData(initData);
    const telegramUser = JSON.parse(data['user'] ?? '{}') as TelegramUserData;
    if (!telegramUser.id) {
      throw new UnauthorizedException('Invalid Telegram user data');
    }

    const fullName =
      [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(' ') ||
      (telegramUser.username ?? 'User');

    const user = await this.usersService.findOrCreateByTelegramId({
      telegramId: String(telegramUser.id),
      firstName: telegramUser.first_name,
      fullName,
      telegramUsername: telegramUser.username,
      avatarUrl: telegramUser.photo_url,
    });

    const token = await this.jwtService.signAsync({
      sub: user.id,
      telegramId: user.telegramId,
    });
    return { user, token };
  }

  // Development-only: allows local browser testing without a Telegram client.
  async devLogin(): Promise<{ user: User; token: string }> {
    const devTelegramId = this.configService.get<string>(
      'DEV_TELEGRAM_ID',
      '900000001',
    );
    const user = await this.usersService.findOrCreateByTelegramId({
      telegramId: devTelegramId,
      firstName: 'Abebe',
      fullName: 'Abebe Kebede',
      telegramUsername: 'abebe',
    });
    const token = await this.jwtService.signAsync({
      sub: user.id,
      telegramId: user.telegramId,
    });
    return { user, token };
  }

 
  private validateInitData(initData: string): Record<string, string> {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Missing initData hash');
    }

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    if (!botToken) {
      throw new UnauthorizedException('Telegram bot token is not configured');
    }

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      throw new UnauthorizedException('initData signature is invalid');
    }

    const authDate = Number(params.get('auth_date') ?? 0);
    const ageSeconds = Date.now() / 1000 - authDate;
    if (authDate <= 0 || ageSeconds > 60 * 60 * 24) {
      throw new UnauthorizedException('initData is expired');
    }

    return Object.fromEntries(params.entries());
  }
}

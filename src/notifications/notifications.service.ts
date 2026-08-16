import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly usersService: UsersService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.read = true;
    return this.notificationRepository.save(notification);
  }

  async create(data: {
    userId: string;
    title: string;
    description: string;
    type?: NotificationType;
  }): Promise<Notification> {
    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: data.userId,
        title: data.title,
        description: data.description,
        type: data.type ?? NotificationType.INFO,
      }),
    );
    await this.pushToTelegram(data.userId, data.title, data.description);
    return notification;
  }

  // Best-effort push via the bot. Never lets a Telegram failure (user
  // blocked the bot, network hiccup, etc.) fail the underlying action.
  private async pushToTelegram(
    userId: string,
    title: string,
    description: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) return;
      await this.bot.telegram.sendMessage(
        user.telegramId,
        `${title}\n${description}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to push Telegram notification to user ${userId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

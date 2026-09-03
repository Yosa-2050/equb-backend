import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Notification, NotificationType } from './entities/notification.entity';

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  read?: boolean;
  equbId?: string;
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly usersService: UsersService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  async findAllForUser(
    userId: string,
    query: ListNotificationsQuery = {},
  ): Promise<PaginatedNotifications> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: FindOptionsWhere<Notification> = { userId };
    if (query.read !== undefined) where.read = query.read;
    if (query.equbId) where.equbId = query.equbId;
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : new Date(0);
      const to = query.to ? new Date(query.to) : new Date();
      where.createdAt = Between(from, to);
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      relations: ['equb'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, read: false },
    });

    return { items, total, page, limit, unreadCount };
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

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update(
      { userId, read: false },
      { read: true },
    );
    return { updated: result.affected ?? 0 };
  }

  async create(data: {
    userId: string;
    title: string;
    description: string;
    type?: NotificationType;
    equbId?: string;
  }): Promise<Notification> {
    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: data.userId,
        title: data.title,
        description: data.description,
        type: data.type ?? NotificationType.INFO,
        equbId: data.equbId ?? null,
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

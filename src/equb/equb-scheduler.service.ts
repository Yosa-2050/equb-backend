import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  daysInEthiopianMonth,
  ethiopianToGregorian,
  gregorianToEthiopian,
} from '../common/ethiopian-calendar';
import { PaymentsService } from '../payments/payments.service';
import { Equb, EqubFrequency, EqubStatus } from './entities/equb.entity';

const ADDIS_TZ = 'Africa/Addis_Ababa';
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface AddisNow {
  hour: number;
  minute: number;
  weekday: number; // 0=Sunday..6=Saturday
  dateKey: string; // YYYY-MM-DD in Addis local time
}

// Both jobs run every 5 minutes, Ethiopia local time (Africa/Addis_Ababa).
@Injectable()
export class EqubSchedulerService {
  private readonly logger = new Logger(EqubSchedulerService.name);

  constructor(
    @InjectRepository(Equb)
    private readonly equbRepository: Repository<Equb>,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Cron('*/5 * * * *', { timeZone: ADDIS_TZ })
  async handlePeriodAdvancement(): Promise<void> {
    const equbs = await this.equbRepository.find({
      where: { status: EqubStatus.ACTIVE },
    });
    const now = new Date();

    for (const equb of equbs) {
      if (!equb.periodStartedAt) continue;
      const deadline = this.periodDeadline(equb);
      if (now >= deadline) {
        try {
          await this.paymentsService.forceAdvancePeriod(equb.id);
        } catch (err) {
          this.logger.error(
            `Failed to advance period for equb ${equb.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  @Cron('*/5 * * * *', { timeZone: ADDIS_TZ })
  async handleReminders(): Promise<void> {
    const equbs = await this.equbRepository.find({
      where: { status: EqubStatus.ACTIVE },
    });

    for (const equb of equbs) {
      if (!this.isReminderDue(equb)) continue;
      try {
        await this.paymentsService.remindInternal(equb.id);
        equb.lastReminderSentAt = new Date();
        await this.equbRepository.save(equb);
      } catch (err) {
        this.logger.error(
          `Failed to send reminder for equb ${equb.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  // When the current period's deadline is, based on when it started and the
  // equb's frequency.
  private periodDeadline(equb: Equb): Date {
    const start = new Date(equb.periodStartedAt!);
    switch (equb.frequency) {
      case EqubFrequency.DAILY:
        return new Date(start.getTime() + 24 * 60 * 60 * 1000);
      case EqubFrequency.WEEKLY:
        return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      case EqubFrequency.MONTHLY:
      default: {
        const eStart = gregorianToEthiopian(start);
        let month = eStart.month + 1;
        let year = eStart.year;
        if (month > 13) {
          month = 1;
          year += 1;
        }
        const day = Math.min(eStart.day, daysInEthiopianMonth(year, month));
        return ethiopianToGregorian(year, month, day);
      }
    }
  }

  private isReminderDue(equb: Equb): boolean {
    if (!equb.reminderTime) return false;

    const now = this.addisNow(new Date());
    const [hh, mm] = equb.reminderTime.split(':').map(Number);
    if (now.hour !== hh) return false;
    if (Math.abs(now.minute - mm) > 2) return false; // tolerance around this 5-min sweep

    if (equb.lastReminderSentAt) {
      const last = this.addisNow(equb.lastReminderSentAt);
      if (last.dateKey === now.dateKey) return false; // already sent today
    }

    if (equb.frequency === EqubFrequency.WEEKLY) {
      if (equb.reminderDayOfWeek == null || now.weekday !== equb.reminderDayOfWeek) {
        return false;
      }
    }
    if (equb.frequency === EqubFrequency.MONTHLY) {
      if (equb.reminderDayOfMonth == null) return false;
      const eNow = gregorianToEthiopian(new Date());
      if (eNow.day !== equb.reminderDayOfMonth) return false;
    }

    return true;
  }

  private addisNow(date: Date): AddisNow {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ADDIS_TZ,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const hour = Number(get('hour')) % 24;
    const minute = Number(get('minute'));
    const weekday = WEEKDAY_INDEX[get('weekday')] ?? 0;
    const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
    return { hour, minute, weekday, dateKey };
  }
}

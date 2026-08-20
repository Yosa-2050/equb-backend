import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EqubMember } from './equb-member.entity';

export enum EqubStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum EqubFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum PaymentCollector {
  ADMIN = 'admin',
  WINNER = 'winner',
}

@Entity('equbs')
export class Equb {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  monthlyAmount!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalPot!: number;

  // Admin-entered total amount of the equb (yamidersachew), separate from
  // the auto-computed totalPot (monthlyAmount x durationMonths).
  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount!: number;

  @Column('int')
  durationMonths!: number;

  @Column({ unique: true })
  inviteCode!: string;

  @Column({ type: 'enum', enum: EqubStatus, default: EqubStatus.ACTIVE })
  status!: EqubStatus;

  @Column({ default: true })
  isPublic!: boolean;

  @Column({ nullable: true })
  description!: string;

  @Column('int', { default: 1 })
  currentRound!: number;

  @Column({ type: 'date', nullable: true })
  nextDrawDate!: string;

  @Column({ type: 'int', nullable: true })
  maxMembers!: number | null;

  @Column({
    type: 'enum',
    enum: EqubFrequency,
    default: EqubFrequency.MONTHLY,
  })
  frequency!: EqubFrequency;

  // When the current period (day/week/month) started. The scheduler
  // force-advances the round once now >= periodStartedAt + 1 period,
  // regardless of who has paid.
  @Column({ type: 'timestamptz', nullable: true })
  periodStartedAt!: Date | null;

  // Reminder schedule (Ethiopia local time, HH:mm, 24h).
  @Column({ type: 'varchar', nullable: true })
  reminderTime!: string | null;

  // 0 (Sunday) .. 6 (Saturday). Only used when frequency = weekly.
  @Column({ type: 'int', nullable: true })
  reminderDayOfWeek!: number | null;

  // Ethiopian calendar day-of-month (1-30). Only used when frequency = monthly.
  @Column({ type: 'int', nullable: true })
  reminderDayOfMonth!: number | null;

  // Prevents the scheduler from sending the same automatic reminder twice.
  @Column({ type: 'timestamptz', nullable: true })
  lastReminderSentAt!: Date | null;

  // Who receives contributions and approves/rejects receipts each round:
  // the round's lottery winner (default, existing behavior) or always the
  // equb admin.
  @Column({
    type: 'enum',
    enum: PaymentCollector,
    default: PaymentCollector.WINNER,
  })
  collector!: PaymentCollector;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminId' })
  admin!: User;

  @Column()
  adminId!: string;

  @OneToMany(() => EqubMember, (member) => member.equb)
  members!: EqubMember[];

  @CreateDateColumn()
  createdAt!: Date;
}

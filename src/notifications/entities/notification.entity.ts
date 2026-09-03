import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Equb } from '../../equb/entities/equb.entity';

export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @Column()
  title!: string;

  @Column()
  description!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type!: NotificationType;

  @Column({ default: false })
  read!: boolean;

  // Which equb this notification is about, if any (join/lottery/payment
  // events all belong to one; a few system-level notices don't).
  @ManyToOne(() => Equb, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equbId' })
  equb!: Equb | null;

  @Column({ type: 'uuid', nullable: true })
  equbId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

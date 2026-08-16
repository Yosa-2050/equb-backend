import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EqubMember } from '../../equb/entities/equb-member.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REJECTED = 'rejected',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => EqubMember)
  @JoinColumn({ name: 'equbMemberId' })
  equbMember!: EqubMember;

  @Column()
  equbMemberId!: string;

  @ManyToOne(() => EqubMember)
  @JoinColumn({ name: 'recipientId' })
  recipient!: EqubMember;

  @Column({ type: 'uuid', nullable: true })
  recipientId!: string | null;

  @Column('int')
  month!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ nullable: true })
  receiptImageUrl!: string;

  @Column({ type: 'date', nullable: true })
  receiptDate!: string;

  @Column({ type: 'varchar', nullable: true })
  rejectReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

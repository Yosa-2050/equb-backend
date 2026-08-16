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

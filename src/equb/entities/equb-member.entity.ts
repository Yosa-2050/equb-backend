import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Equb } from './equb.entity';

export enum EqubMemberStatus {
  ACTIVE = 'active',
  LEFT = 'left',
}

export enum EqubMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('equb_members')
@Unique(['equb', 'user'])
export class EqubMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Equb, (equb) => equb.members)
  @JoinColumn({ name: 'equbId' })
  equb!: Equb;

  @Column()
  equbId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @Column({
    type: 'enum',
    enum: EqubMemberRole,
    default: EqubMemberRole.MEMBER,
  })
  role!: EqubMemberRole;

  // Payout order/month assigned when the lottery is run (1..N)
  @Column({ type: 'int', nullable: true })
  order!: number | null;

  @Column({ default: false })
  hasWon!: boolean;

  @Column({ nullable: true })
  accountProvider!: string;

  @Column({ nullable: true })
  accountNumber!: string;

  // Name on the bank/mobile-money account, which may differ from the
  // member's Telegram display name.
  @Column({ nullable: true })
  accountHolderName!: string;

  // Per-member override of equb.monthlyAmount. Null means "use the equb's
  // default rate".
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  contributionAmount!: number | null;

  @Column({
    type: 'enum',
    enum: EqubMemberStatus,
    default: EqubMemberStatus.ACTIVE,
  })
  status!: EqubMemberStatus;

  @CreateDateColumn()
  joinedAt!: Date;
}

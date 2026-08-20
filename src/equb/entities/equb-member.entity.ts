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

export enum CollabRole {
  LEADER = 'leader',
  MEMBER = 'member',
}

export enum EqubMemberAssignmentSource {
  ADMIN_PICK = 'admin_pick',
  LOTTERY = 'lottery',
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

  @Column({
    type: 'enum',
    enum: EqubMemberAssignmentSource,
    nullable: true,
  })
  assignmentSource!: EqubMemberAssignmentSource | null;

  @Column({ default: false })
  hasWon!: boolean;

  @Column({ nullable: true })
  accountProvider!: string;

  @Column({ nullable: true })
  accountNumber!: string;

  
  @Column({ nullable: true })
  accountHolderName!: string;


  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  contributionAmount!: number | null;

  // Collab group membership: members sharing one lottery slot & payout.
  @Column({ type: 'uuid', nullable: true })
  collabGroupId!: string | null;

  @Column({ type: 'enum', enum: CollabRole, nullable: true })
  collabRole!: CollabRole | null;

  @Column({
    type: 'enum',
    enum: EqubMemberStatus,
    default: EqubMemberStatus.ACTIVE,
  })
  status!: EqubMemberStatus;

  @CreateDateColumn()
  joinedAt!: Date;
}

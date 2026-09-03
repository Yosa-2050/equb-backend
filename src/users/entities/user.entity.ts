import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserLanguage {
  EN = 'en',
  AM = 'am',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', unique: true })
  telegramId!: string;

  @Column()
  fullName!: string;

  @Column({ type: 'varchar', nullable: true })
  displayName!: string | null;

  @Column({ nullable: true })
  telegramUsername!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  avatarUrl!: string;

  @Column({ type: 'enum', enum: UserLanguage, default: UserLanguage.AM })
  language!: UserLanguage;

  @CreateDateColumn()
  createdAt!: Date;
}

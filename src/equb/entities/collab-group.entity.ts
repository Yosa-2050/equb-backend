import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';


@Entity('collab_groups')
export class CollabGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  equbId!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

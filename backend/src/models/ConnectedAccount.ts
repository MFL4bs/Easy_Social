import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

export type PlatformType = 'facebook' | 'instagram' | 'twitter' | 'tiktok';

@Entity('connected_accounts')
export class ConnectedAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-enum', enum: ['facebook', 'instagram', 'twitter', 'tiktok'] })
  platform!: PlatformType;

  @Column({ length: 255 })
  platformUserId!: string;

  @Column({ length: 255, nullable: true })
  platformUsername!: string;

  @Column({ length: 255, nullable: true })
  platformDisplayName!: string;

  @Column({ type: 'text' })
  accessToken!: string;

  @Column({ type: 'text', nullable: true })
  refreshToken!: string;

  @Column({ type: 'datetime', nullable: true })
  tokenExpiresAt!: Date;

  @Column({ type: 'simple-json', default: '{}' })
  platformMetadata!: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;

  @ManyToOne(() => User, (user) => user.connectedAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
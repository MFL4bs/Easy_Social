import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ConnectedAccount } from './ConnectedAccount';
import { ContentItem } from './ContentItem';

export type UserRole = 'admin' | 'editor' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 255 })
  passwordHash!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({
    type: 'simple-enum',
    enum: ['admin', 'editor', 'viewer'],
    default: 'editor',
  })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ConnectedAccount, (account) => account.user)
  connectedAccounts!: ConnectedAccount[];

  @OneToMany(() => ContentItem, (content) => content.createdBy)
  contentItems!: ContentItem[];
}
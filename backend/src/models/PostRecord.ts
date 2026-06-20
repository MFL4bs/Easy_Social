import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentItem } from './ContentItem';

export type PostStatus = 'queued' | 'publishing' | 'published' | 'failed';
export type PlatformType = 'facebook' | 'instagram' | 'twitter' | 'tiktok';

@Entity('post_records')
export class PostRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-enum', enum: ['facebook', 'instagram', 'twitter', 'tiktok'] })
  platform!: PlatformType;

  @Column({ length: 255, nullable: true })
  platformPostId!: string;

  @Column({ nullable: true })
  platformPostUrl!: string;

  @Column({
    type: 'simple-enum',
    enum: ['queued', 'publishing', 'published', 'failed'],
    default: 'queued',
  })
  status!: PostStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string;

  @Column({ type: 'simple-json', nullable: true })
  platformResponse!: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date;

  @ManyToOne(() => ContentItem, (content) => content.postRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentItemId' })
  contentItem!: ContentItem;

  @Column()
  contentItemId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { PostRecord } from './PostRecord';

export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed';

export type MediaType = 'image' | 'video' | 'carousel';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 500 })
  caption!: string;

  @Column({ type: 'text', nullable: true })
  body!: string;

  @Column({ type: 'simple-array', nullable: true })
  hashtags!: string[];

  @Column({ type: 'simple-array', nullable: true })
  mediaUrls!: string[];

  @Column({ type: 'simple-enum', enum: ['image', 'video', 'carousel'], nullable: true })
  mediaType!: MediaType;

  @Column({ nullable: true })
  linkUrl!: string;

  @Column({
    type: 'simple-enum',
    enum: ['draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed'],
    default: 'draft',
  })
  status!: ContentStatus;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date;

  @Column({ type: 'simple-array', default: '' })
  targetPlatforms!: string[];

  @ManyToOne(() => User, (user) => user.contentItems)
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @Column()
  createdById!: string;

  @OneToMany(() => PostRecord, (record) => record.contentItem)
  postRecords!: PostRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
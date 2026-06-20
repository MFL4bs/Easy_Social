import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type PlatformType = 'facebook' | 'instagram' | 'twitter' | 'tiktok';
export type MetricType = 'impressions' | 'reach' | 'likes' | 'comments' | 'shares' | 'followers' | 'click_throughs' | 'engagement_rate';

@Entity('analytics_records')
@Index(['platform', 'platformAccountId', 'recordedAt'])
export class AnalyticsRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-enum', enum: ['facebook', 'instagram', 'twitter', 'tiktok'] })
  platform!: PlatformType;

  @Column({ length: 255 })
  platformAccountId!: string;

  @Column({ type: 'simple-enum', enum: ['impressions', 'reach', 'likes', 'comments', 'shares', 'followers', 'click_throughs', 'engagement_rate'] })
  metric!: MetricType;

  @Column({ type: 'float' })
  value!: number;

  @Column({ type: 'datetime' })
  recordedAt!: Date;

  @Column({ type: 'simple-json', nullable: true })
  breakdown!: Record<string, number>;

  @Column({ length: 255, nullable: true })
  postId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
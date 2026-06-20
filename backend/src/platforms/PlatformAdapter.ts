import { ConnectedAccount } from '../models/ConnectedAccount';
import { ContentItem } from '../models/ContentItem';

export interface PostResult {
  platformPostId: string;
  platformPostUrl?: string;
  platformResponse?: Record<string, unknown>;
}

export interface AccountInfo {
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformMetadata?: Record<string, unknown>;
}

export interface AnalyticsData {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  followers: number;
  clickThroughs: number;
  engagementRate: number;
  breakdown?: Record<string, number>;
}

export interface PlatformAdapter {
  readonly platform: string;

  /** Exchange OAuth code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;

  /** Refresh an expired access token */
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;

  /** Get account info for the authenticated user */
  getAccountInfo(accessToken: string): Promise<AccountInfo>;

  /** Post content to the platform */
  postContent(
    account: ConnectedAccount,
    content: ContentItem
  ): Promise<PostResult>;

  /** Get analytics for a connected account */
  getAnalytics(
    account: ConnectedAccount,
    since: Date,
    until: Date
  ): Promise<AnalyticsData>;

  /** Get analytics for a specific post */
  getPostAnalytics(
    account: ConnectedAccount,
    platformPostId: string
  ): Promise<AnalyticsData>;

  /** Validate that the access token is still valid */
  validateToken(accessToken: string): Promise<boolean>;
}
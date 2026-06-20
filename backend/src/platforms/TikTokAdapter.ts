import axios from 'axios';
import { PlatformAdapter, PostResult, AccountInfo, AnalyticsData } from './PlatformAdapter';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { ContentItem } from '../models/ContentItem';

const TIKTOK_API_BASE = 'https://open-api.tiktok.com';

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok';

  private get clientKey(): string {
    return process.env.TIKTOK_CLIENT_KEY || '';
  }

  private get clientSecret(): string {
    return process.env.TIKTOK_CLIENT_SECRET || '';
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const response = await axios.post(
      `${TIKTOK_API_BASE}/oauth/access_token/`,
      {
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }
    );

    const data = response.data.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const response = await axios.post(
      `${TIKTOK_API_BASE}/oauth/refresh_token/`,
      {
        client_key: this.clientKey,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }
    );

    const data = response.data.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await axios.get(`${TIKTOK_API_BASE}/user/info/`, {
      params: {
        fields: 'open_id,union_id,avatar_url,display_name,username,bio',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = response.data.data.user;
    return {
      platformUserId: user.open_id || user.union_id,
      platformUsername: user.username,
      platformDisplayName: user.display_name,
      platformMetadata: {
        avatarUrl: user.avatar_url,
        bio: user.bio,
      },
    };
  }

  async postContent(account: ConnectedAccount, content: ContentItem): Promise<PostResult> {
    // TikTok requires video upload via their API
    if (content.mediaType !== 'video' || !content.mediaUrls?.length) {
      throw new Error('TikTok only supports video posts');
    }

    // Step 1: Initialize upload
    const initResponse = await axios.post(
      `${TIKTOK_API_BASE}/video/upload/init/`,
      {
        access_token: account.accessToken,
        source_info: {
          source: 'FILE_UPLOAD',
          video_metadata: {
            video_url: content.mediaUrls[0],
          },
        },
      }
    );

    const uploadUrl = initResponse.data.data.upload_url;

    // Step 2: Upload video (in production, use the presigned upload URL)
    const videoResponse = await axios.put(uploadUrl, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '0', // Need actual content size
      },
    });

    // Step 3: Create post
    const postResponse = await axios.post(
      `${TIKTOK_API_BASE}/video/publish/`,
      {
        access_token: account.accessToken,
        post_info: {
          title: this.buildTitle(content),
          privacy_level: 'PUBLIC',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          brand_organic_opt_in: false,
          brand_content_opt_in: false,
        },
      }
    );

    const publishData = postResponse.data.data;
    return {
      platformPostId: publishData.publish_id,
      platformPostUrl: `https://tiktok.com/@${account.platformUsername}/video/${publishData.publish_id}`,
      platformResponse: publishData,
    };
  }

  async getAnalytics(account: ConnectedAccount, since: Date, until: Date): Promise<AnalyticsData> {
    const response = await axios.get(`${TIKTOK_API_BASE}/user/data/`, {
      params: {
        fields: 'follower_count,follower_distribution,follower_gender,follower_age,follower_top_countries,views_count,profile_views,likes_count,comments_count,shares_count',
        start_date: since.toISOString().split('T')[0],
        end_date: until.toISOString().split('T')[0],
      },
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    });

    const data = response.data.data;
    return {
      impressions: data.views_count || 0,
      reach: data.views_count || 0,
      likes: data.likes_count || 0,
      comments: data.comments_count || 0,
      shares: data.shares_count || 0,
      followers: data.follower_count || 0,
      clickThroughs: 0,
      engagementRate: data.views_count > 0
        ? ((data.likes_count + data.comments_count + data.shares_count) / data.views_count) * 100
        : 0,
    };
  }

  async getPostAnalytics(account: ConnectedAccount, platformPostId: string): Promise<AnalyticsData> {
    const response = await axios.get(`${TIKTOK_API_BASE}/video/data/`, {
      params: {
        fields: 'view_count,like_count,comment_count,share_count,play_count,reach_count',
        publish_id: platformPostId,
      },
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    });

    const data = response.data.data;
    return {
      impressions: data.view_count || 0,
      reach: data.reach_count || 0,
      likes: data.like_count || 0,
      comments: data.comment_count || 0,
      shares: data.share_count || 0,
      followers: 0,
      clickThroughs: 0,
      engagementRate: data.view_count > 0
        ? ((data.like_count + data.comment_count + data.share_count) / data.view_count) * 100
        : 0,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(`${TIKTOK_API_BASE}/user/info/`, {
        params: { fields: 'open_id' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildTitle(content: ContentItem): string {
    let title = content.caption;
    if (content.hashtags && content.hashtags.length > 0) {
      title += ' ' + content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    }
    return title;
  }
}
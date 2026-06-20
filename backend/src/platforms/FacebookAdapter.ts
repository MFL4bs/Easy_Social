import axios from 'axios';
import { PlatformAdapter, PostResult, AccountInfo, AnalyticsData } from './PlatformAdapter';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { ContentItem } from '../models/ContentItem';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

export class FacebookAdapter implements PlatformAdapter {
  readonly platform = 'facebook';

  private get clientId(): string {
    return process.env.FACEBOOK_APP_ID || '';
  }

  private get clientSecret(): string {
    return process.env.FACEBOOK_APP_SECRET || '';
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

    // Exchange short-lived token for long-lived token
    const longLived = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        fb_exchange_token: response.data.access_token,
      },
    });

    return {
      accessToken: longLived.data.access_token,
      expiresIn: longLived.data.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    // Facebook long-lived tokens last 60 days; refresh by re-exchanging
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        fb_exchange_token: refreshToken,
      },
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await axios.get(`${GRAPH_API_BASE}/me`, {
      params: {
        fields: 'id,name,accounts{id,name}',
        access_token: accessToken,
      },
    });

    return {
      platformUserId: response.data.id,
      platformDisplayName: response.data.name,
      platformMetadata: {
        pages: response.data.accounts?.data || [],
      },
    };
  }

  async postContent(account: ConnectedAccount, content: ContentItem): Promise<PostResult> {
    // Post to Facebook Page (requires page access token)
    const pageId = account.platformMetadata?.pageId || account.platformUserId;

    const postData: Record<string, unknown> = {
      message: this.buildMessage(content),
      access_token: account.accessToken,
    };

    if (content.linkUrl) {
      postData.link = content.linkUrl;
    }

    if (content.mediaUrls && content.mediaUrls.length > 0) {
      // For images, use the /photos endpoint; for video, use /videos
      if (content.mediaType === 'video') {
        const response = await axios.post(`${GRAPH_API_BASE}/${pageId}/videos`, {
          file_url: content.mediaUrls[0],
          description: this.buildMessage(content),
          access_token: account.accessToken,
        });
        return {
          platformPostId: response.data.id,
          platformPostUrl: `https://facebook.com/${response.data.id}`,
          platformResponse: response.data,
        };
      }

      // For images, publish first photo then attach others
      const response = await axios.post(`${GRAPH_API_BASE}/${pageId}/photos`, {
        url: content.mediaUrls[0],
        message: this.buildMessage(content),
        access_token: account.accessToken,
      });
      return {
        platformPostId: response.data.id,
        platformPostUrl: `https://facebook.com/${response.data.id}`,
        platformResponse: response.data,
      };
    }

    // Text-only post
    const response = await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, postData);
    return {
      platformPostId: response.data.id,
      platformPostUrl: `https://facebook.com/${response.data.id}`,
      platformResponse: response.data,
    };
  }

  async getAnalytics(account: ConnectedAccount, since: Date, until: Date): Promise<AnalyticsData> {
    const pageId = account.platformMetadata?.pageId || account.platformUserId;
    const response = await axios.get(`${GRAPH_API_BASE}/${pageId}/insights`, {
      params: {
        metric: 'page_impressions,page_impressions_unique,page_fans,page_engaged_users,page_actions_post_reactions_like_total,page_actions_post_reactions_comment_total,page_actions_post_reactions_share_total',
        period: 'day',
        since: Math.floor(since.getTime() / 1000),
        until: Math.floor(until.getTime() / 1000),
        access_token: account.accessToken,
      },
    });

    const data = this.parseInsightsResponse(response.data);
    return data;
  }

  async getPostAnalytics(account: ConnectedAccount, platformPostId: string): Promise<AnalyticsData> {
    const response = await axios.get(`${GRAPH_API_BASE}/${platformPostId}/insights`, {
      params: {
        metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_reactions_like_total,post_comments,post_shares',
        access_token: account.accessToken,
      },
    });

    return this.parseInsightsResponse(response.data);
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/me`, {
        params: { access_token: accessToken },
      });
      return !!response.data.id;
    } catch {
      return false;
    }
  }

  private buildMessage(content: ContentItem): string {
    let message = content.caption;
    if (content.hashtags && content.hashtags.length > 0) {
      message += '\n\n' + content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    }
    if (content.body) {
      message = content.body + '\n\n' + message;
    }
    return message;
  }

  private parseInsightsResponse(data: { data?: Array<{ name: string; values?: Array<{ value: number }> }> }): AnalyticsData {
    const result: AnalyticsData = {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      followers: 0,
      clickThroughs: 0,
      engagementRate: 0,
    };

    if (!data.data) return result;

    for (const metric of data.data) {
      const value = metric.values?.[metric.values.length - 1]?.value || 0;
      switch (metric.name) {
        case 'page_impressions':
        case 'post_impressions':
          result.impressions = value;
          break;
        case 'page_impressions_unique':
        case 'post_impressions_unique':
          result.reach = value;
          break;
        case 'page_fans':
          result.followers = value;
          break;
        case 'page_engaged_users':
        case 'post_engaged_users':
          result.engagementRate = value > 0 && result.reach > 0 ? (value / result.reach) * 100 : 0;
          break;
        case 'page_actions_post_reactions_like_total':
        case 'post_reactions_like_total':
          result.likes = value;
          break;
        case 'page_actions_post_reactions_comment_total':
        case 'post_comments':
          result.comments = value;
          break;
        case 'page_actions_post_reactions_share_total':
        case 'post_shares':
          result.shares = value;
          break;
      }
    }

    return result;
  }
}
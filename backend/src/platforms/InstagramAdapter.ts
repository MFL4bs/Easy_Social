import axios from 'axios';
import { PlatformAdapter, PostResult, AccountInfo, AnalyticsData } from './PlatformAdapter';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { ContentItem } from '../models/ContentItem';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram';

  private get clientId(): string {
    return process.env.FACEBOOK_APP_ID || '';
  }

  private get clientSecret(): string {
    return process.env.FACEBOOK_APP_SECRET || '';
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    // Instagram uses Facebook's Graph API for Business/Messenger accounts
    const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    });

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
    // First get Facebook Pages, then get connected Instagram accounts
    const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
      params: {
        access_token: accessToken,
      },
    });

    const page = pagesResponse.data.data?.[0];
    if (!page) {
      throw new Error('No Facebook Page found. An Instagram Business account must be connected to a Facebook Page.');
    }

    const igResponse = await axios.get(`${GRAPH_API_BASE}/${page.id}`, {
      params: {
        fields: 'instagram_business_account{id,username,name}',
        access_token: accessToken,
      },
    });

    const igAccount = igResponse.data.instagram_business_account;
    return {
      platformUserId: igAccount.id,
      platformUsername: igAccount.username,
      platformDisplayName: igAccount.name,
      platformMetadata: {
        facebookPageId: page.id,
        facebookPageName: page.name,
      },
    };
  }

  async postContent(account: ConnectedAccount, content: ContentItem): Promise<PostResult> {
    const igUserId = account.platformUserId;

    // Instagram requires creating a media container first, then publishing it
    if (content.mediaType === 'video') {
      // Create video container
      const containerResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, {
        media_type: 'VIDEO',
        video_url: content.mediaUrls?.[0],
        caption: this.buildCaption(content),
        access_token: account.accessToken,
      });

      const containerId = containerResponse.data.id;

      // Wait for container to be ready (polling)
      await this.waitForMediaContainer(containerId, account.accessToken);

      // Publish
      const publishResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
        creation_id: containerId,
        access_token: account.accessToken,
      });

      return {
        platformPostId: publishResponse.data.id,
        platformPostUrl: `https://instagram.com/p/${publishResponse.data.id}`,
        platformResponse: publishResponse.data,
      };
    }

    if (content.mediaUrls && content.mediaUrls.length > 1) {
      // Carousel (multiple images)
      const childrenIds: string[] = [];
      for (const url of content.mediaUrls) {
        const childResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, {
          image_url: url,
          is_carousel_item: true,
          access_token: account.accessToken,
        });
        childrenIds.push(childResponse.data.id);
      }

      // Create carousel container
      const carouselResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: childrenIds,
        caption: this.buildCaption(content),
        access_token: account.accessToken,
      });

      const containerId = carouselResponse.data.id;
      await this.waitForMediaContainer(containerId, account.accessToken);

      const publishResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
        creation_id: containerId,
        access_token: account.accessToken,
      });

      return {
        platformPostId: publishResponse.data.id,
        platformPostUrl: `https://instagram.com/p/${publishResponse.data.id}`,
        platformResponse: publishResponse.data,
      };
    }

    // Single image
    const containerResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, {
      image_url: content.mediaUrls?.[0],
      caption: this.buildCaption(content),
      access_token: account.accessToken,
    });

    const containerId = containerResponse.data.id;
    await this.waitForMediaContainer(containerId, account.accessToken);

    const publishResponse = await axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: account.accessToken,
    });

    return {
      platformPostId: publishResponse.data.id,
      platformPostUrl: `https://instagram.com/p/${publishResponse.data.id}`,
      platformResponse: publishResponse.data,
    };
  }

  private async waitForMediaContainer(containerId: string, accessToken: string, maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      const statusResponse = await axios.get(`${GRAPH_API_BASE}/${containerId}`, {
        params: {
          fields: 'status_code',
          access_token: accessToken,
        },
      });

      const status = statusResponse.data.status_code;
      if (status === 'FINISHED') return;
      if (status === 'ERROR') {
        throw new Error('Instagram media container failed to process');
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 30000)));
    }

    throw new Error('Instagram media container timed out');
  }

  async getAnalytics(account: ConnectedAccount, since: Date, until: Date): Promise<AnalyticsData> {
    const igUserId = account.platformUserId;

    const response = await axios.get(`${GRAPH_API_BASE}/${igUserId}/insights`, {
      params: {
        metric: 'impressions,reach,profile_views,follower_count,likes,comments,shares',
        period: 'day',
        since: since.toISOString().split('T')[0],
        until: until.toISOString().split('T')[0],
        access_token: account.accessToken,
      },
    });

    return this.parseInsightsResponse(response.data);
  }

  async getPostAnalytics(account: ConnectedAccount, platformPostId: string): Promise<AnalyticsData> {
    const response = await axios.get(`${GRAPH_API_BASE}/${platformPostId}/insights`, {
      params: {
        metric: 'impressions,reach,likes,comments,shares,saved',
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

  private buildCaption(content: ContentItem): string {
    let caption = content.caption;
    if (content.hashtags && content.hashtags.length > 0) {
      caption += '\n\n' + content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    }
    return caption;
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
      const value = metric.values?.reduce((sum, v) => sum + v.value, 0) || 0;
      switch (metric.name) {
        case 'impressions':
          result.impressions = value;
          break;
        case 'reach':
          result.reach = value;
          break;
        case 'follower_count':
          result.followers = value;
          break;
        case 'likes':
          result.likes = value;
          break;
        case 'comments':
          result.comments = value;
          break;
        case 'shares':
          result.shares = value;
          break;
        case 'saved':
          break;
      }
    }

    result.engagementRate = result.reach > 0
      ? ((result.likes + result.comments + result.shares) / result.reach) * 100
      : 0;

    return result;
  }
}
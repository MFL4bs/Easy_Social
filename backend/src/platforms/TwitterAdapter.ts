import axios from 'axios';
import { PlatformAdapter, PostResult, AccountInfo, AnalyticsData } from './PlatformAdapter';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { ContentItem } from '../models/ContentItem';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

export class TwitterAdapter implements PlatformAdapter {
  readonly platform = 'twitter';

  private get clientId(): string {
    return process.env.TWITTER_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.TWITTER_CLIENT_SECRET || '';
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: 'challenge', // In production, generate and store PKCE challenge
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await axios.get(`${TWITTER_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        'user.fields': 'id,name,username,public_metrics',
      },
    });

    const user = response.data.data;
    return {
      platformUserId: user.id,
      platformUsername: user.username,
      platformDisplayName: user.name,
      platformMetadata: {
        publicMetrics: user.public_metrics,
      },
    };
  }

  async postContent(account: ConnectedAccount, content: ContentItem): Promise<PostResult> {
    const tweetText = this.buildTweetText(content);

    // Twitter API v2 requires media upload via media/upload endpoint first
    let mediaIds: string[] = [];
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      // For media uploads, Twitter requires the v1.1 API with OAuth 1.0a user context
      // In this implementation, we reference the media in the v2 API
      // Real implementation would upload to Twitter's media endpoint
      console.warn('Twitter media upload requires OAuth 1.0a; implement media upload separately');
    }

    const response = await axios.post(
      `${TWITTER_API_BASE}/tweets`,
      {
        text: tweetText,
        ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      platformPostId: response.data.data.id,
      platformPostUrl: `https://twitter.com/${account.platformUsername}/status/${response.data.data.id}`,
      platformResponse: response.data,
    };
  }

  async getAnalytics(account: ConnectedAccount, since: Date, until: Date): Promise<AnalyticsData> {
    const userId = account.platformUserId;

    // Get user metrics
    const userResponse = await axios.get(`${TWITTER_API_BASE}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
      params: {
        'user.fields': 'public_metrics',
      },
    });

    const metrics = userResponse.data.data.public_metrics;

    // Get recent tweets for engagement metrics
    const tweetsResponse = await axios.get(`${TWITTER_API_BASE}/users/${userId}/tweets`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
      params: {
        max_results: 100,
        start_time: since.toISOString(),
        end_time: until.toISOString(),
        'tweet.fields': 'public_metrics',
      },
    });

    let totalLikes = 0;
    let totalReplies = 0;
    let totalRetweets = 0;
    let totalImpressions = 0;

    if (tweetsResponse.data.data) {
      for (const tweet of tweetsResponse.data.data) {
        const tweetMetrics = tweet.public_metrics || {};
        totalLikes += tweetMetrics.like_count || 0;
        totalReplies += tweetMetrics.reply_count || 0;
        totalRetweets += tweetMetrics.retweet_count || 0;
        totalImpressions += tweetMetrics.impression_count || 0;
      }
    }

    return {
      impressions: totalImpressions,
      reach: totalImpressions,
      likes: totalLikes,
      comments: totalReplies,
      shares: totalRetweets,
      followers: metrics.followers_count || 0,
      clickThroughs: 0,
      engagementRate: totalImpressions > 0
        ? ((totalLikes + totalReplies + totalRetweets) / totalImpressions) * 100
        : 0,
    };
  }

  async getPostAnalytics(account: ConnectedAccount, platformPostId: string): Promise<AnalyticsData> {
    const response = await axios.get(`${TWITTER_API_BASE}/tweets/${platformPostId}`, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
      params: {
        'tweet.fields': 'public_metrics,non_public_metrics',
      },
    });

    const metrics = response.data.data.public_metrics || {};
    const nonPublic = response.data.data.non_public_metrics || {};

    return {
      impressions: nonPublic.impression_count || 0,
      reach: nonPublic.impression_count || 0,
      likes: metrics.like_count || 0,
      comments: metrics.reply_count || 0,
      shares: metrics.retweet_count || 0,
      followers: 0,
      clickThroughs: nonPublic.url_link_clicks || 0,
      engagementRate: 0,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(`${TWITTER_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildTweetText(content: ContentItem): string {
    // Twitter has a 280-character limit
    let text = content.caption;
    if (content.linkUrl) {
      text += ' ' + content.linkUrl;
    }
    if (content.hashtags && content.hashtags.length > 0) {
      const hashtagStr = ' ' + content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
      text += hashtagStr;
    }

    // Truncate to 280 chars if needed
    if (text.length > 280) {
      text = text.substring(0, 277) + '...';
    }

    return text;
  }
}
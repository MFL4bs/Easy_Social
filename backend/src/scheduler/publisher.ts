import { AppDataSource } from '../config/database';
import { ContentItem } from '../models/ContentItem';
import { PostRecord } from '../models/PostRecord';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { PlatformRegistry } from '../platforms/PlatformRegistry';

/**
 * Publishes a single content item to all its target platforms.
 * Called by the Bull queue worker or directly for immediate publish.
 */
export async function publishContent(contentId: string): Promise<void> {
  const contentRepo = AppDataSource.getRepository(ContentItem);
  const postRecordRepo = AppDataSource.getRepository(PostRecord);
  const accountRepo = AppDataSource.getRepository(ConnectedAccount);

  const content = await contentRepo.findOne({
    where: { id: contentId },
    relations: ['postRecords', 'createdBy'],
  });

  if (!content) {
    console.error(`Content ${contentId} not found for publishing`);
    return;
  }

  console.log(`Publishing content ${contentId} to platforms: ${content.targetPlatforms.join(', ')}`);

  for (const platform of content.targetPlatforms) {
    try {
      // Create or update post record
      let postRecord = await postRecordRepo.findOne({
        where: { contentItemId: contentId, platform: platform as any },
      });

      if (!postRecord) {
        postRecord = postRecordRepo.create({
          contentItemId: contentId,
          platform: platform as any,
          status: 'queued',
        });
      }

      postRecord.status = 'publishing';
      await postRecordRepo.save(postRecord);

      // Get the connected account for this platform
      const account = await accountRepo.findOne({
        where: { userId: content.createdById, platform: platform as any, isActive: true },
      });

      if (!account) {
        throw new Error(`No connected ${platform} account found for user ${content.createdById}`);
      }

      // Check token expiry and refresh if needed
      if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
        if (account.refreshToken) {
          const adapter = PlatformRegistry.getAdapter(platform);
          const refreshed = await adapter.refreshToken(account.refreshToken);
          account.accessToken = refreshed.accessToken;
          if (refreshed.refreshToken) account.refreshToken = refreshed.refreshToken;
          account.tokenExpiresAt = refreshed.expiresIn
            ? new Date(Date.now() + refreshed.expiresIn * 1000)
            : null;
          await accountRepo.save(account);
        } else {
          throw new Error(`Token expired for ${platform} and no refresh token available`);
        }
      }

      // Publish via the platform adapter
      const adapter = PlatformRegistry.getAdapter(platform);
      const result = await adapter.postContent(account, content);

      // Update post record with success
      postRecord.status = 'published';
      postRecord.platformPostId = result.platformPostId;
      postRecord.platformPostUrl = result.platformPostUrl;
      postRecord.platformResponse = result.platformResponse;
      postRecord.publishedAt = new Date();
      await postRecordRepo.save(postRecord);

      console.log(`Successfully published to ${platform}: ${result.platformPostId}`);
    } catch (error) {
      console.error(`Failed to publish to ${platform}:`, error);

      // Update post record with failure
      const postRecord = await postRecordRepo.findOne({
        where: { contentItemId: contentId, platform: platform as any },
      });

      if (postRecord) {
        postRecord.status = 'failed';
        postRecord.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        postRecord.retryCount = (postRecord.retryCount || 0) + 1;
        await postRecordRepo.save(postRecord);
      }
    }
  }

  // Update content status to published if all platforms succeeded
  content.status = 'published';
  content.publishedAt = new Date();
  await contentRepo.save(content);

  console.log(`Content ${contentId} publishing complete`);
}
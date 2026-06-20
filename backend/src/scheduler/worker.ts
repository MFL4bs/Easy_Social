import cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { ContentItem } from '../models/ContentItem';
import { publishContent } from './publisher';
import { LessThanOrEqual } from 'typeorm';

/**
 * Scheduler worker that runs every minute to check for content
 * that needs to be published.
 */
export function startScheduler(): void {
  console.log('Scheduler worker started - checking every minute for content to publish');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const contentRepo = AppDataSource.getRepository(ContentItem);

      // Find all approved/scheduled content that is due
      const dueContent = await contentRepo.find({
        where: [
          { status: 'approved' },
          { status: 'scheduled', scheduledAt: LessThanOrEqual(new Date()) },
        ],
      });

      if (dueContent.length === 0) return;

      console.log(`Found ${dueContent.length} content items due for publishing`);

      for (const content of dueContent) {
        try {
          await publishContent(content.id);
        } catch (error) {
          console.error(`Failed to publish content ${content.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });
}
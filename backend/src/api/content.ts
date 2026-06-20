import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ContentItem } from '../models/ContentItem';
import { PostRecord } from '../models/PostRecord';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/content - List all content items (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, platform, from, to, page = '1', limit = '20' } = req.query;
    const contentRepo = AppDataSource.getRepository(ContentItem);

    const query = contentRepo.createQueryBuilder('content')
      .leftJoinAndSelect('content.postRecords', 'postRecords')
      .where('content.createdById = :userId', { userId: req.userId });

    if (status) {
      query.andWhere('content.status = :status', { status });
    }
    if (from) {
      query.andWhere('content.scheduledAt >= :from', { from: new Date(from as string) });
    }
    if (to) {
      query.andWhere('content.scheduledAt <= :to', { to: new Date(to as string) });
    }
    if (platform) {
      query.andWhere('content.targetPlatforms LIKE :platform', { platform: `%${platform}%` });
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const [items, total] = await query
      .orderBy('content.scheduledAt', 'DESC')
      .skip(skip)
      .take(parseInt(limit as string, 10))
      .getManyAndCount();

    res.json({
      items: items.map((item) => ({
        id: item.id,
        caption: item.caption,
        body: item.body,
        hashtags: item.hashtags,
        mediaUrls: item.mediaUrls,
        mediaType: item.mediaType,
        linkUrl: item.linkUrl,
        status: item.status,
        scheduledAt: item.scheduledAt,
        publishedAt: item.publishedAt,
        targetPlatforms: item.targetPlatforms,
        postRecords: item.postRecords?.map((r) => ({
          id: r.id,
          platform: r.platform,
          status: r.status,
          platformPostId: r.platformPostId,
          platformPostUrl: r.platformPostUrl,
          errorMessage: r.errorMessage,
          publishedAt: r.publishedAt,
        })),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });
  } catch (error) {
    console.error('List content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/content/calendar - Calendar view (scheduled items)
router.get('/calendar', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const contentRepo = AppDataSource.getRepository(ContentItem);

    const query = contentRepo.createQueryBuilder('content')
      .leftJoinAndSelect('content.postRecords', 'postRecords')
      .where('content.createdById = :userId', { userId: req.userId })
      .andWhere('content.scheduledAt IS NOT NULL');

    if (from) {
      query.andWhere('content.scheduledAt >= :from', { from: new Date(from as string) });
    }
    if (to) {
      query.andWhere('content.scheduledAt <= :to', { to: new Date(to as string) });
    }

    const items = await query
      .orderBy('content.scheduledAt', 'ASC')
      .getMany();

    res.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.caption.substring(0, 100),
        start: item.scheduledAt,
        status: item.status,
        platforms: item.targetPlatforms,
        mediaType: item.mediaType,
      })),
    });
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/content - Create a new content item
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { caption, body, hashtags, mediaUrls, mediaType, linkUrl, scheduledAt, targetPlatforms } = req.body;

    if (!caption) {
      res.status(400).json({ error: 'Caption is required' });
      return;
    }

    const contentRepo = AppDataSource.getRepository(ContentItem);
    const content = contentRepo.create({
      caption,
      body,
      hashtags: hashtags || [],
      mediaUrls: mediaUrls || [],
      mediaType,
      linkUrl,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      targetPlatforms: targetPlatforms || [],
      status: scheduledAt ? 'scheduled' : 'draft',
      createdById: req.userId!,
    });

    await contentRepo.save(content);

    res.status(201).json({
      id: content.id,
      caption: content.caption,
      status: content.status,
      scheduledAt: content.scheduledAt,
      targetPlatforms: content.targetPlatforms,
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/content/:id - Update a content item
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contentRepo = AppDataSource.getRepository(ContentItem);
    const content = await contentRepo.findOne({
      where: { id, createdById: req.userId },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const { caption, body, hashtags, mediaUrls, mediaType, linkUrl, scheduledAt, targetPlatforms, status } = req.body;

    if (caption !== undefined) content.caption = caption;
    if (body !== undefined) content.body = body;
    if (hashtags !== undefined) content.hashtags = hashtags;
    if (mediaUrls !== undefined) content.mediaUrls = mediaUrls;
    if (mediaType !== undefined) content.mediaType = mediaType;
    if (linkUrl !== undefined) content.linkUrl = linkUrl;
    if (scheduledAt !== undefined) content.scheduledAt = scheduledAt ? new Date(scheduledAt) : null as any;
    if (targetPlatforms !== undefined) content.targetPlatforms = targetPlatforms;

    // Recalculate status unless explicitly overridden to published/failed
    const protectedStatuses = ['published', 'failed'];
    if (status !== undefined && protectedStatuses.includes(status)) {
      content.status = status;
    } else if (!protectedStatuses.includes(content.status)) {
      content.status = content.scheduledAt ? 'scheduled' : 'draft';
    }

    await contentRepo.save(content);

    res.json({ id: content.id, status: content.status, scheduledAt: content.scheduledAt });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/content/:id/approve - Approve content for publishing
router.post('/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contentRepo = AppDataSource.getRepository(ContentItem);
    const content = await contentRepo.findOne({
      where: { id, createdById: req.userId },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    if (content.status !== 'pending_approval') {
      res.status(400).json({ error: `Cannot approve content with status: ${content.status}` });
      return;
    }

    content.status = content.scheduledAt ? 'scheduled' : 'approved';
    await contentRepo.save(content);

    res.json({ id: content.id, status: content.status });
  } catch (error) {
    console.error('Approve content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/content/:id/publish-now - Immediately publish content
router.post('/:id/publish-now', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contentRepo = AppDataSource.getRepository(ContentItem);
    const content = await contentRepo.findOne({
      where: { id, createdById: req.userId },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    if (!['approved', 'scheduled', 'draft'].includes(content.status)) {
      res.status(400).json({ error: `Cannot publish content with status: ${content.status}` });
      return;
    }

    content.status = 'approved';
    content.scheduledAt = new Date(); // Publish immediately
    await contentRepo.save(content);

    // The scheduler worker will pick this up
    res.json({ id: content.id, status: content.status, message: 'Content queued for immediate publishing' });
  } catch (error) {
    console.error('Publish now error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/content/:id - Delete a content item
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const contentRepo = AppDataSource.getRepository(ContentItem);
    const content = await contentRepo.findOne({
      where: { id, createdById: req.userId },
    });

    if (!content) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    await contentRepo.remove(content);
    res.json({ message: 'Content deleted' });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
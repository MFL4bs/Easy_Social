import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AnalyticsRecord } from '../models/AnalyticsRecord';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { PlatformRegistry } from '../platforms/PlatformRegistry';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Between } from 'typeorm';

const router = Router();

// GET /api/analytics/dashboard - Get dashboard overview
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string, 10));
    const until = new Date();

    const accountRepo = AppDataSource.getRepository(ConnectedAccount);
    const accounts = await accountRepo.find({
      where: { userId: req.userId, isActive: true },
    });

    const overview = { totalFollowers: 0, totalImpressions: 0, totalEngagement: 0, totalPosts: 0, followersGrowth: 0, impressionsGrowth: 0 };
    const platforms: Record<string, any> = {};
    let timeline: Array<Record<string, any>> = [];

    for (const account of accounts) {
      try {
        const adapter = PlatformRegistry.getAdapter(account.platform);
        const analytics = await adapter.getAnalytics(account, since, until);

        overview.totalFollowers += analytics.followers;
        overview.totalImpressions += analytics.impressions;
        overview.totalEngagement += analytics.likes + analytics.comments + analytics.shares;

        platforms[account.platform] = {
          username: account.platformUsername,
          displayName: account.platformDisplayName,
          ...analytics,
        };
      } catch (err) {
        console.warn(`Failed to fetch analytics for ${account.platform}:`, err);
        platforms[account.platform] = {
          username: account.platformUsername,
          error: 'Failed to fetch analytics',
        };
      }
    }

    // Get timeline data from stored analytics records
    const analyticsRepo = AppDataSource.getRepository(AnalyticsRecord);
    const timelineRecords = await analyticsRepo.find({
      where: { recordedAt: Between(since, until) },
      order: { recordedAt: 'ASC' },
    });

    // Aggregate timeline by date
    const timelineMap = new Map<string, Record<string, number>>();
    for (const record of timelineRecords) {
      const dateKey = record.recordedAt.toISOString().split('T')[0];
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, followers: 0 });
      }
      const day = timelineMap.get(dateKey)!;
      day[record.metric] = (day[record.metric] || 0) + record.value;
    }

    timeline = Array.from(timelineMap.entries()).map(([date, metrics]) => ({
      date,
      ...metrics,
    }));

    res.json({ overview, platforms, timeline });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/export/csv - Export analytics as CSV
router.get('/export/csv', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, platform } = req.query;
    const since = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = to ? new Date(to as string) : new Date();

    const analyticsRepo = AppDataSource.getRepository(AnalyticsRecord);
    const whereClause: any = {
      recordedAt: Between(since, until),
    };

    if (platform) {
      whereClause.platform = platform;
    }

    const records = await analyticsRepo.find({
      where: whereClause,
      order: { recordedAt: 'ASC' },
    });

    // Build CSV
    const headers = ['Date', 'Platform', 'Metric', 'Value'];
    const csvLines = [headers.join(',')];

    for (const record of records) {
      csvLines.push([
        record.recordedAt.toISOString().split('T')[0],
        record.platform,
        record.metric,
        record.value.toString(),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${since.toISOString().split('T')[0]}-to-${until.toISOString().split('T')[0]}.csv`);
    res.send(csvLines.join('\n'));
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/export/pdf - Export analytics as PDF
router.get('/export/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, platform } = req.query;
    const since = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = to ? new Date(to as string) : new Date();

    const analyticsRepo = AppDataSource.getRepository(AnalyticsRecord);
    const whereClause: any = {
      recordedAt: Between(since, until),
    };

    if (platform) {
      whereClause.platform = platform;
    }

    const records = await analyticsRepo.find({
      where: whereClause,
      order: { recordedAt: 'ASC' },
    });

    // Build simple PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${since.toISOString().split('T')[0]}-to-${until.toISOString().split('T')[0]}.pdf`);

    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${since.toISOString().split('T')[0]} to ${until.toISOString().split('T')[0]}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const summary: Record<string, { impressions: number; likes: number; comments: number; shares: number }> = {};
    for (const record of records) {
      if (!summary[record.platform]) {
        summary[record.platform] = { impressions: 0, likes: 0, comments: 0, shares: 0 };
      }
      if (record.metric === 'impressions') summary[record.platform].impressions += record.value;
      if (record.metric === 'likes') summary[record.platform].likes += record.value;
      if (record.metric === 'comments') summary[record.platform].comments += record.value;
      if (record.metric === 'shares') summary[record.platform].shares += record.value;
    }

    doc.fontSize(14).text('Summary by Platform', { underline: true });
    doc.moveDown();

    for (const [platform, data] of Object.entries(summary)) {
      doc.fontSize(12).text(`Platform: ${platform}`);
      doc.fontSize(10).text(`  Impressions: ${data.impressions}`);
      doc.fontSize(10).text(`  Likes: ${data.likes}`);
      doc.fontSize(10).text(`  Comments: ${data.comments}`);
      doc.fontSize(10).text(`  Shares: ${data.shares}`);
      doc.moveDown();
    }

    // Detail table
    doc.fontSize(14).text('Detailed Records', { underline: true });
    doc.moveDown();

    const tableTop = doc.y;
    const colWidths = [80, 80, 100, 80];
    const headers = ['Date', 'Platform', 'Metric', 'Value'];

    doc.fontSize(10).font('Helvetica-Bold');
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
      xPos += colWidths[i];
    });

    doc.moveDown(0.5);
    let yPos = doc.y;
    doc.font('Helvetica');

    for (const record of records.slice(0, 200)) { // Limit to 200 rows for PDF
      xPos = 50;
      const row = [
        record.recordedAt.toISOString().split('T')[0],
        record.platform,
        record.metric,
        record.value.toString(),
      ];

      row.forEach((cell, i) => {
        doc.text(cell, xPos, yPos, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      yPos += 15;
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/:platform - Get analytics for a specific platform
router.get('/:platform', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.params;
    const { days = '30' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string, 10));
    const until = new Date();

    const accountRepo = AppDataSource.getRepository(ConnectedAccount);
    const account = await accountRepo.findOne({
      where: { userId: req.userId, platform: platform as any, isActive: true },
    });

    if (!account) {
      res.status(404).json({ error: `No connected ${platform} account found` });
      return;
    }

    const adapter = PlatformRegistry.getAdapter(platform);
    const analytics = await adapter.getAnalytics(account, since, until);

    // Get stored records for timeline
    const analyticsRepo = AppDataSource.getRepository(AnalyticsRecord);
    const records = await analyticsRepo.find({
      where: { platform: platform as any, platformAccountId: account.platformUserId },
      order: { recordedAt: 'ASC' },
    });

    const timelineMap = new Map<string, Record<string, number>>();
    for (const record of records) {
      const dateKey = record.recordedAt.toISOString().split('T')[0];
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, followers: 0 });
      }
      const day = timelineMap.get(dateKey)!;
      day[record.metric] = (day[record.metric] || 0) + record.value;
    }

    res.json({
      account: {
        username: account.platformUsername,
        displayName: account.platformDisplayName,
      },
      current: analytics,
      timeline: Array.from(timelineMap.entries()).map(([date, metrics]) => ({
        date,
        ...metrics,
      })),
    });
  } catch (error) {
    console.error('Platform analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
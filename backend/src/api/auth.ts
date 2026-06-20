import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { ConnectedAccount } from '../models/ConnectedAccount';
import { PlatformRegistry } from '../platforms/PlatformRegistry';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const existing = await userRepo.findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepo.create({ email, passwordHash, name });
    await userRepo.save(user);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'change_me_in_production',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'change_me_in_production',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.userId },
      relations: ['connectedAccounts'],
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      connectedAccounts: user.connectedAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        platformUsername: a.platformUsername,
        platformDisplayName: a.platformDisplayName,
        isActive: a.isActive,
      })),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/:platform/connect
// Returns the OAuth URL for the given platform
router.get('/:platform/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.params;
    const adapter = PlatformRegistry.getAdapter(platform);

    // Build OAuth URL based on platform
    let authUrl = '';
    const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/auth/${platform}/callback`;

    switch (platform) {
      case 'facebook':
      case 'instagram':
        authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${req.userId}&scope=pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_user_content`;
        break;
      case 'twitter':
        authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${req.userId}&scope=tweet.read+tweet.write+users.read+offline.access&code_challenge=challenge&code_challenge_method=plain`;
        break;
      case 'tiktok':
        authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&scope=user.info.basic,video.publish,video.upload&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${req.userId}`;
        break;
      default:
        res.status(400).json({ error: `Unsupported platform: ${platform}` });
        return;
    }

    res.json({ authUrl, platform, redirectUri });
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/:platform/callback
// OAuth callback handler
router.get('/:platform/callback', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      res.status(400).json({ error: 'Missing authorization code or state parameter' });
      return;
    }

    const adapter = PlatformRegistry.getAdapter(platform);
    const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/auth/${platform}/callback`;

    // Exchange code for tokens
    const tokenData = await adapter.exchangeCode(code as string, redirectUri);

    // Get account info
    const accountInfo = await adapter.getAccountInfo(tokenData.accessToken);

    // Save connected account
    const accountRepo = AppDataSource.getRepository(ConnectedAccount);
    const existingAccount = await accountRepo.findOne({
      where: { userId: userId as string, platform, platformUserId: accountInfo.platformUserId },
    });

    if (existingAccount) {
      // Update existing account
      existingAccount.accessToken = tokenData.accessToken;
      existingAccount.refreshToken = tokenData.refreshToken || existingAccount.refreshToken;
      existingAccount.tokenExpiresAt = tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000)
        : null;
      existingAccount.platformUsername = accountInfo.platformUsername || existingAccount.platformUsername;
      existingAccount.platformDisplayName = accountInfo.platformDisplayName || existingAccount.platformDisplayName;
      existingAccount.platformMetadata = accountInfo.platformMetadata || existingAccount.platformMetadata;
      existingAccount.isActive = true;
      await accountRepo.save(existingAccount);
    } else {
      const newAccount = accountRepo.create({
        userId: userId as string,
        platform: platform as any,
        platformUserId: accountInfo.platformUserId,
        platformUsername: accountInfo.platformUsername,
        platformDisplayName: accountInfo.platformDisplayName,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiresAt: tokenData.expiresIn
          ? new Date(Date.now() + tokenData.expiresIn * 1000)
          : null,
        platformMetadata: accountInfo.platformMetadata || {},
      });
      await accountRepo.save(newAccount);
    }

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?platform=${platform}&connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?error=connection_failed`);
  }
});

// DELETE /api/auth/:platform/disconnect
router.delete('/:platform/disconnect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { platform } = req.params;
    const accountRepo = AppDataSource.getRepository(ConnectedAccount);
    const account = await accountRepo.findOne({
      where: { userId: req.userId, platform: platform as any },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    account.isActive = false;
    await accountRepo.save(account);

    res.json({ message: `Disconnected ${platform} account` });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
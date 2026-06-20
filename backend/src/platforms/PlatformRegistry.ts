import { PlatformAdapter } from './PlatformAdapter';
import { FacebookAdapter } from './FacebookAdapter';
import { InstagramAdapter } from './InstagramAdapter';
import { TwitterAdapter } from './TwitterAdapter';
import { TikTokAdapter } from './TikTokAdapter';

export type PlatformType = 'facebook' | 'instagram' | 'twitter' | 'tiktok';

class PlatformRegistryImpl {
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor() {
    this.register(new FacebookAdapter());
    this.register(new InstagramAdapter());
    this.register(new TwitterAdapter());
    this.register(new TikTokAdapter());
  }

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  getAdapter(platform: string): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Unsupported platform: ${platform}. Available platforms: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    return adapter;
  }

  hasAdapter(platform: string): boolean {
    return this.adapters.has(platform);
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }

  /** Add a custom/external platform adapter at runtime */
  extendPlatform(platform: string, adapter: PlatformAdapter): void {
    if (this.adapters.has(platform)) {
      console.warn(`Overriding existing adapter for platform: ${platform}`);
    }
    this.adapters.set(platform, adapter);
  }
}

export const PlatformRegistry = new PlatformRegistryImpl();
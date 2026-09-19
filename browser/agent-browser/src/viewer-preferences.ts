import type { BrowserViewerPreferences, ScreencastOptions } from '@mastra/core/browser';
import type { BrowserContext, CDPSession, Page } from 'playwright-core';

/** Browser protocol settings, shared by the tools and viewer on the same context. */
export class ViewerPreferences {
  private current?: BrowserViewerPreferences;
  private pages = new Map<
    Page,
    { session: Promise<CDPSession>; applied?: BrowserViewerPreferences; pending: Promise<void> }
  >();

  constructor(private context: BrowserContext) {
    context.on('page', page => {
      void this.apply(page).catch(() => {});
    });
    context.once('close', () => this.pages.clear());
  }

  get(page: Page): BrowserViewerPreferences | undefined {
    return this.pages.get(page)?.applied;
  }

  async capture(page: Page, options: ScreencastOptions): Promise<string | undefined> {
    await this.apply(page);
    const entry = this.pages.get(page);
    const preferences = entry?.applied;
    if (!entry || !preferences || preferences.deviceScaleFactor <= 1) return undefined;
    // Chromium capture uses the emulation state of the calling CDP session.
    // Reuse the preference session; a second session can temporarily resize the
    // page while capturing, breaking input and tools during that interval.
    const session = await entry.session;
    const { width, height, deviceScaleFactor } = preferences;
    const { layoutViewport } = await session.send('Page.getLayoutMetrics');
    const { data } = await session.send('Page.captureScreenshot', {
      format: options.format ?? 'jpeg',
      ...(options.format !== 'png' ? { quality: options.quality ?? 80 } : {}),
      captureBeyondViewport: false,
      clip: {
        x: layoutViewport.pageX,
        y: layoutViewport.pageY,
        width,
        height,
        scale: Math.min(
          1,
          (options.maxWidth ?? 1280) / (width * deviceScaleFactor),
          (options.maxHeight ?? 720) / (height * deviceScaleFactor),
        ),
      },
    });
    return data;
  }

  async set(preferences: BrowserViewerPreferences) {
    const locale = Intl.getCanonicalLocales(preferences.locale)[0];
    if (
      !locale ||
      !Number.isInteger(preferences.width) ||
      !Number.isInteger(preferences.height) ||
      preferences.width < 240 ||
      preferences.width > 3840 ||
      preferences.height < 160 ||
      preferences.height > 2160 ||
      !Number.isFinite(preferences.deviceScaleFactor) ||
      preferences.deviceScaleFactor < 1 ||
      preferences.deviceScaleFactor > 2
    ) {
      throw new Error('Invalid browser viewer preferences');
    }
    this.current = { ...preferences, locale };
    await Promise.all(this.context.pages().map(page => this.apply(page)));
  }

  async apply(page: Page): Promise<void> {
    const preferences = this.current;
    if (!preferences || page.isClosed()) return;
    let entry = this.pages.get(page);
    if (!entry) {
      entry = { session: this.context.newCDPSession(page), pending: Promise.resolve() };
      this.pages.set(page, entry);
      page.once('close', () => this.pages.delete(page));
    }
    const target = entry;
    const work = target.pending.then(async () => {
      if (target.applied === preferences || page.isClosed()) return;
      const session = await target.session;
      // Playwright keeps screenshots and tool coordinates in the same CSS viewport.
      await page.setViewportSize({ width: preferences.width, height: preferences.height });
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: preferences.width,
        height: preferences.height,
        deviceScaleFactor: preferences.deviceScaleFactor,
        mobile: false,
      });
      if (target.applied?.locale !== preferences.locale) {
        const { userAgent } = await session.send('Browser.getVersion');
        await session.send('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: preferences.locale });
        await session.send('Emulation.setLocaleOverride', { locale: preferences.locale });
      }
      target.applied = preferences;
    });
    target.pending = work.catch(() => {});
    await work;
  }
}

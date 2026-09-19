import type { BrowserViewerPreferences } from '@mastra/core/browser';
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
        scale: preferences.deviceScaleFactor,
        dontSetVisibleSize: true,
      });
      await session.send('Emulation.setVisibleSize', {
        width: Math.round(preferences.width * preferences.deviceScaleFactor),
        height: Math.round(preferences.height * preferences.deviceScaleFactor),
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

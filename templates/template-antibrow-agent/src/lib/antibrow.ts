import { AntiDetectBrowser } from 'anti-detect-browser';
import type { BrowserContext, Page } from 'playwright-core';
import dotenv from 'dotenv';
dotenv.config({ path: '.env', quiet: true });

/**
 * One AntiBrow profile, shared by every tool.
 *
 * The profile is the unit of identity: the same name always gets back the same
 * cookies, storage and fingerprint, so an agent that signed in on an earlier run
 * is still signed in on the next one. The session is closed after an idle period
 * so a long-running server does not keep a browser alive forever.
 */
class AntibrowSessionManager {
  private static instance: AntibrowSessionManager;
  private context: BrowserContext | null = null;
  private browser: { close(): Promise<void> } | null = null;
  private page: Page | null = null;
  private lastUsed = Date.now();
  private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    setInterval(() => this.checkAndCleanupSession(), 60 * 1000);
  }

  public static getInstance(): AntibrowSessionManager {
    if (!AntibrowSessionManager.instance) {
      AntibrowSessionManager.instance = new AntibrowSessionManager();
    }
    return AntibrowSessionManager.instance;
  }

  /** Launch the profile if it is not already running, and return its page. */
  public async ensurePage(): Promise<Page> {
    this.lastUsed = Date.now();

    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    const key = process.env.ANTI_DETECT_BROWSER_KEY;
    if (!key) {
      throw new Error('ANTI_DETECT_BROWSER_KEY is not set. Add it to .env - see .env.example.');
    }

    const profile = process.env.ANTIBROW_PROFILE ?? 'mastra-agent';
    const ab = new AntiDetectBrowser({ key });
    const session = await ab.launch({
      profile,
      label: profile,
      proxy: process.env.ANTIBROW_PROXY,
      focusWindow: false,
    });

    this.browser = session.browser;
    this.context = session.context;
    this.page = session.page;
    return this.page;
  }

  /** Close the browser. An abandoned one is a whole browser still running. */
  public async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    this.context = null;
    this.page = null;
    if (browser) {
      await browser.close();
    }
  }

  private async checkAndCleanupSession(): Promise<void> {
    if (!this.browser) return;
    if (Date.now() - this.lastUsed > this.sessionTimeout) {
      console.log('Closing idle AntiBrow session');
      await this.close().catch(() => undefined);
    }
  }
}

export const sessionManager = AntibrowSessionManager.getInstance();

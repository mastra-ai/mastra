/**
 * StagehandBrowser - AI-powered browser automation using Stagehand
 *
 * Uses natural language instructions for browser interactions.
 * Fundamentally different from AgentBrowser's deterministic refs approach.
 */

import { MastraBrowser } from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { StagehandBrowserConfig, StagehandAction, CdpUrlProvider } from './types';
import type { ActInput, ExtractInput, ObserveInput, NavigateInput, ScreenshotInput } from './schemas';
import { createStagehandTools } from './tools';

// Stagehand type - we use any to avoid import issues, actual runtime behavior is fine
type StagehandInstance = any;

/**
 * Resolve a CDP URL provider to a string
 */
async function resolveCdpUrl(provider: CdpUrlProvider): Promise<string> {
  if (typeof provider === 'string') {
    return provider;
  }
  return provider();
}

/**
 * StagehandBrowser - AI-powered browser using Stagehand
 *
 * Unlike AgentBrowser which uses refs ([ref=e1]), StagehandBrowser uses
 * natural language instructions for all interactions.
 */
export class StagehandBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'StagehandBrowser';
  override readonly provider = 'browserbase/stagehand';

  private stagehand: StagehandInstance = null;
  private stagehandConfig: StagehandBrowserConfig;

  constructor(config: StagehandBrowserConfig = {}) {
    super(config);
    this.id = `stagehand-${Date.now()}`;
    this.stagehandConfig = config;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
    // Dynamic import to avoid bundling issues
    const { Stagehand } = await import('@browserbasehq/stagehand');

    const config = this.stagehandConfig;

    // Build Stagehand configuration
    const stagehandOptions: any = {
      env: config.env ?? 'LOCAL',
      modelName: typeof config.model === 'string' ? config.model : config.model?.modelName,
      modelClientOptions:
        typeof config.model === 'object' ? { apiKey: config.model.apiKey, baseURL: config.model.baseURL } : undefined,
      selfHeal: config.selfHeal ?? true,
      domSettleTimeoutMs: config.domSettleTimeout,
      enableCaching: config.cacheDir ? true : false,
      verbose: config.verbose ?? 1,
      systemPrompt: config.systemPrompt,
    };

    // Handle Browserbase configuration
    if (config.env === 'BROWSERBASE') {
      if (config.apiKey) {
        stagehandOptions.apiKey = config.apiKey;
      }
      if (config.projectId) {
        stagehandOptions.projectId = config.projectId;
      }
    }

    // Handle CDP URL for local browser with custom endpoint
    if (config.cdpUrl && config.env !== 'BROWSERBASE') {
      const cdpUrl = await resolveCdpUrl(config.cdpUrl);
      stagehandOptions.localBrowserLaunchOptions = {
        cdpUrl,
        headless: config.headless,
      };
    } else if (config.headless !== undefined && config.env !== 'BROWSERBASE') {
      stagehandOptions.localBrowserLaunchOptions = {
        headless: config.headless,
      };
    }

    this.stagehand = new Stagehand(stagehandOptions);
    await this.stagehand.init();
  }

  protected override async doClose(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private requireStagehand(): StagehandInstance {
    if (!this.stagehand) {
      throw new Error('Browser not launched');
    }
    return this.stagehand;
  }

  // ---------------------------------------------------------------------------
  // Tools - Implements MastraBrowser.getTools()
  // ---------------------------------------------------------------------------

  override getTools(): Record<string, Tool<any, any>> {
    return createStagehandTools(this);
  }

  // ---------------------------------------------------------------------------
  // Core AI Methods
  // ---------------------------------------------------------------------------

  /**
   * Perform an action using natural language instruction
   */
  async act(input: ActInput): Promise<{
    success: boolean;
    message?: string;
    action?: string;
    url?: string;
    hint?: string;
    error?: string;
  }> {
    const stagehand = this.requireStagehand();
    const url = stagehand.page?.url() ?? '';

    try {
      const actOptions = {
        action: input.instruction,
        variables: input.variables,
        timeoutMs: input.timeout,
      };

      const result = await stagehand.act(actOptions);

      return {
        success: result.success,
        message: result.message,
        action: result.action,
        url: stagehand.page?.url() ?? url,
        hint: 'Use observe() to discover available actions or extract() to get page data.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: msg,
        error: 'act_failed',
        url,
        hint: 'Try rephrasing the instruction or use observe() to see available actions.',
      };
    }
  }

  /**
   * Extract structured data from a page using natural language
   */
  async extract(input: ExtractInput): Promise<{
    success: boolean;
    data?: unknown;
    url?: string;
    hint?: string;
    error?: string;
  }> {
    const stagehand = this.requireStagehand();
    const url = stagehand.page?.url() ?? '';

    try {
      // If schema is provided, pass it; otherwise just use instruction
      const extractOptions = {
        instruction: input.instruction,
        schema: input.schema,
      };

      const result = await stagehand.extract(extractOptions);

      return {
        success: true,
        data: result,
        url: stagehand.page?.url() ?? url,
        hint: 'Data extracted successfully. Use act() to perform actions based on this data.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: msg,
        url,
        hint: 'Try simplifying the extraction instruction or use observe() to understand the page structure.',
      };
    }
  }

  /**
   * Discover actionable elements on a page
   */
  async observe(input: ObserveInput): Promise<{
    success: boolean;
    actions: StagehandAction[];
    url?: string;
    hint?: string;
    error?: string;
  }> {
    const stagehand = this.requireStagehand();
    const url = stagehand.page?.url() ?? '';

    try {
      const observeOptions = {
        instruction: input.instruction,
        onlyVisible: input.onlyVisible,
      };

      const actions = await stagehand.observe(observeOptions);

      return {
        success: true,
        actions: actions.map((a: any) => ({
          selector: a.selector,
          description: a.description,
          method: a.method,
          arguments: a.arguments,
        })) as StagehandAction[],
        url: stagehand.page?.url() ?? url,
        hint:
          actions.length > 0
            ? `Found ${actions.length} actions. Use act() with a specific instruction to execute one.`
            : 'No actions found. Try a different instruction or navigate to a different page.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        actions: [],
        error: msg,
        url,
        hint: 'Try a different instruction or ensure the page has loaded completely.',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation & State Methods
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL
   */
  async navigate(input: NavigateInput): Promise<{
    success: boolean;
    url: string;
    title: string;
    hint: string;
    error?: string;
  }> {
    const stagehand = this.requireStagehand();
    const page = stagehand.page;

    if (!page) {
      return {
        success: false,
        url: input.url,
        title: '',
        error: 'no_page',
        hint: 'Browser page not available.',
      };
    }

    try {
      await page.goto(input.url, {
        waitUntil: input.waitUntil ?? 'domcontentloaded',
      });

      const url = page.url();
      const title = await page.title();

      return {
        success: true,
        url,
        title,
        hint: 'Page loaded. Use observe() to discover actions or extract() to get data.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        url: input.url,
        title: '',
        error: msg,
        hint: 'Navigation failed. Check the URL and try again.',
      };
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(input: ScreenshotInput): Promise<{
    success: boolean;
    base64: string;
    error?: string;
  }> {
    const stagehand = this.requireStagehand();

    try {
      const buffer = await stagehand.screenshot({
        fullPage: input.fullPage ?? false,
      });

      return {
        success: true,
        base64: buffer.toString('base64'),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        base64: '',
        error: msg,
      };
    }
  }
}

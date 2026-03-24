/**
 * StagehandBrowser - AI-powered browser automation using Stagehand v3
 *
 * Uses natural language instructions for browser interactions.
 * Fundamentally different from AgentBrowser's deterministic refs approach.
 *
 * Stagehand v3 is CDP-native and provides direct CDP access for screencast/input injection.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import { MastraBrowser, ScreencastStreamImpl, createError } from '@mastra/core/browser';
import type {
  BrowserToolError,
  ScreencastOptions,
  ScreencastStream,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { ActInput, ExtractInput, ObserveInput, NavigateInput, ScreenshotInput } from './schemas';
import { createStagehandTools } from './tools';
import type { StagehandBrowserConfig, StagehandAction, CdpUrlProvider } from './types';

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
 * StagehandBrowser - AI-powered browser using Stagehand v3
 *
 * Unlike AgentBrowser which uses refs ([ref=e1]), StagehandBrowser uses
 * natural language instructions for all interactions.
 */
export class StagehandBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'StagehandBrowser';
  override readonly provider = 'browserbase/stagehand';

  private stagehand: Stagehand | null = null;
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
    const { Stagehand } = await import('@browserbasehq/stagehand');

    const config = this.stagehandConfig;

    // Build Stagehand v3 configuration
    const stagehandOptions: any = {
      env: config.env ?? 'LOCAL',
      // v3 uses "provider/model" format
      model: typeof config.model === 'string' ? config.model : config.model?.modelName,
      selfHeal: config.selfHeal ?? true,
      domSettleTimeoutMs: config.domSettleTimeout,
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

  /**
   * Check if the browser is still alive by verifying the context and pages exist.
   * Called by base class ensureReady() to detect externally closed browsers.
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    if (!this.stagehand) {
      return false;
    }
    try {
      const context = this.stagehand.context;
      if (!context) {
        return false;
      }
      const pages = context.pages();
      if (!pages || pages.length === 0) {
        return false;
      }
      // Will throw if browser is disconnected
      pages[0]?.url();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (this.isDisconnectionError(msg)) {
        this.logger.debug?.('Browser was externally closed');
      }
      return false;
    }
  }

  /**
   * Check if an error message indicates browser disconnection.
   */
  isDisconnectionError(message: string): boolean {
    const disconnectPatterns = [
      'Target closed',
      'Target page, context or browser has been closed',
      'Browser has been closed',
      'Connection closed',
      'Protocol error',
      'Session closed',
      'browser has disconnected',
      'closed externally',
    ];
    return disconnectPatterns.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()));
  }

  /**
   * Handle browser disconnection by updating status.
   * This allows ensureReady() to re-launch on next use.
   */
  handleBrowserDisconnected(): void {
    if (this.status !== 'closed') {
      this.status = 'closed';
      this.stagehand = null;
      this.logger.debug?.('Browser was externally closed, status set to closed');
    }
  }

  /**
   * Create an error response from an exception.
   * Handles disconnection detection and returns a consistent BrowserToolError.
   */
  private createErrorFromException(error: unknown, context: string): BrowserToolError {
    const msg = error instanceof Error ? error.message : String(error);

    // Check for browser disconnection errors first
    if (this.isDisconnectionError(msg)) {
      this.handleBrowserDisconnected();
      return createError(
        'browser_closed',
        'Browser was closed externally.',
        'The browser window was closed. Please retry to re-launch.',
      );
    }

    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('aborted')) {
      return createError('timeout', `${context} timed out.`, 'Try again or increase timeout.');
    }

    if (msg.includes('No actions found') || msg.includes('Could not find')) {
      return createError(
        'element_not_found',
        `${context}: Could not find matching element or action.`,
        'Try rephrasing the instruction or use observe() to see available actions.',
      );
    }

    return createError('browser_error', `${context} failed: ${msg}`, 'Check the browser state and try again.');
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private requireStagehand(): Stagehand {
    if (!this.stagehand) {
      throw new Error('Browser not launched');
    }
    return this.stagehand;
  }

  /**
   * Get the current page from Stagehand v3.
   * In v3, pages are accessed via stagehand.context.pages()
   */
  private getPage(): any {
    if (!this.stagehand) return null;

    try {
      const context = this.stagehand.context;
      if (context) {
        const pages = context.pages();
        if (pages && pages.length > 0) {
          return pages[0];
        }
      }
    } catch {
      // Ignore errors - page may not be available
    }

    return null;
  }

  /**
   * Get a CDP session for the current page.
   * In Stagehand v3, we access the CDP session via page.getSessionForFrame()
   */
  private getCdpSession(): any {
    const page = this.getPage();
    if (!page) return null;

    try {
      // Stagehand v3 Page exposes getSessionForFrame(mainFrameId)
      const mainFrameId = page.mainFrameId?.();
      if (mainFrameId && page.getSessionForFrame) {
        return page.getSessionForFrame(mainFrameId);
      }
    } catch {
      // Ignore errors
    }

    return null;
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
  async act(
    input: ActInput,
  ): Promise<{ success: true; message?: string; action?: string; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand();
    const page = this.getPage();
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.act(instruction, options?)
      const result = await stagehand.act(input.instruction, {
        variables: input.variables,
        timeout: input.timeout,
      });

      return {
        success: result.success as true,
        message: result.message,
        action: result.actionDescription,
        url: page?.url() ?? url,
        hint: 'Use observe() to discover available actions or extract() to get page data.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Act');
    }
  }

  /**
   * Extract structured data from a page using natural language
   */
  async extract(
    input: ExtractInput,
  ): Promise<{ success: true; data: unknown; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand();
    const page = this.getPage();
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.extract(instruction, schema?, options?)
      const result = await stagehand.extract(input.instruction, input.schema);

      return {
        success: true,
        data: result,
        url: page?.url() ?? url,
        hint: 'Data extracted successfully. Use act() to perform actions based on this data.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Extract');
    }
  }

  /**
   * Discover actionable elements on a page
   */
  async observe(
    input: ObserveInput,
  ): Promise<{ success: true; actions: StagehandAction[]; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand();
    const page = this.getPage();
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.observe() or stagehand.observe(instruction, options?)
      const actions = input.instruction ? await stagehand.observe(input.instruction) : await stagehand.observe();

      return {
        success: true,
        actions: actions.map((a: any) => ({
          selector: a.selector,
          description: a.description,
          method: a.method,
          arguments: a.arguments,
        })) as StagehandAction[],
        url: page?.url() ?? url,
        hint:
          actions.length > 0
            ? `Found ${actions.length} actions. Use act() with a specific instruction to execute one.`
            : 'No actions found. Try a different instruction or navigate to a different page.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Observe');
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation & State Methods
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL
   */
  async navigate(
    input: NavigateInput,
  ): Promise<{ success: true; url: string; title: string; hint: string } | BrowserToolError> {
    const page = this.getPage();

    if (!page) {
      return createError('browser_error', 'Browser page not available.', 'Ensure the browser is launched.');
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
      return this.createErrorFromException(error, 'Navigate');
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(input: ScreenshotInput): Promise<{ success: true; base64: string } | BrowserToolError> {
    const page = this.getPage();

    if (!page) {
      return createError('browser_error', 'Browser page not available.', 'Ensure the browser is launched.');
    }

    try {
      const buffer = await page.screenshot({
        fullPage: input.fullPage ?? false,
      });

      return {
        success: true,
        base64: buffer.toString('base64'),
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Screenshot');
    }
  }

  // ---------------------------------------------------------------------------
  // URL Tracking (for Studio browser view)
  // ---------------------------------------------------------------------------

  override getCurrentUrl(): string | null {
    const page = this.getPage();
    if (!page) return null;

    try {
      return page.url();
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Screencast (for Studio live view)
  // Uses Stagehand v3's native CDP access
  // ---------------------------------------------------------------------------

  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    const cdpSession = this.getCdpSession();
    if (!cdpSession) {
      throw new Error('No CDP session available for screencast');
    }

    // Create a CDP session provider adapter
    const provider = {
      getCdpSession: async () => cdpSession,
      isBrowserRunning: () => this.isBrowserRunning(),
    };

    const stream = new ScreencastStreamImpl(provider, options);
    await stream.start();
    return stream as unknown as ScreencastStream;
  }

  // ---------------------------------------------------------------------------
  // Event Injection (for Studio live view interactivity)
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(event: MouseEventParams): Promise<void> {
    const cdpSession = this.getCdpSession();
    if (!cdpSession) {
      throw new Error('No CDP session available');
    }

    const buttonMap: Record<string, number> = {
      none: 0,
      left: 0,
      middle: 1,
      right: 2,
    };

    await cdpSession.send('Input.dispatchMouseEvent', {
      type: event.type,
      x: event.x,
      y: event.y,
      button: event.button ?? 'none',
      buttons: buttonMap[event.button ?? 'none'] ?? 0,
      clickCount: event.clickCount ?? 1,
      deltaX: event.deltaX ?? 0,
      deltaY: event.deltaY ?? 0,
      modifiers: event.modifiers ?? 0,
    });
  }

  override async injectKeyboardEvent(event: KeyboardEventParams): Promise<void> {
    const cdpSession = this.getCdpSession();
    if (!cdpSession) {
      throw new Error('No CDP session available');
    }

    await cdpSession.send('Input.dispatchKeyEvent', {
      type: event.type,
      key: event.key,
      code: event.code,
      text: event.text,
      modifiers: event.modifiers ?? 0,
      windowsVirtualKeyCode: event.windowsVirtualKeyCode,
    });
  }
}

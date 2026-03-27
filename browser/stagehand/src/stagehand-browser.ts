/**
 * StagehandBrowser - AI-powered browser automation using Stagehand v3
 *
 * Uses natural language instructions for browser interactions.
 * Fundamentally different from AgentBrowser's deterministic refs approach.
 *
 * Stagehand v3 is CDP-native and provides direct CDP access for screencast/input injection.
 */

import type { Stagehand } from '@browserbasehq/stagehand';
import { MastraBrowser, ScreencastStreamImpl, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type {
  BrowserToolError,
  ScreencastOptions,
  ScreencastStream,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { ActInput, ExtractInput, ObserveInput, NavigateInput, ScreenshotInput } from './schemas';
import { StagehandThreadManager } from './thread-manager';
import { createStagehandTools } from './tools';
import type { StagehandBrowserConfig, StagehandAction } from './types';

// Type for Stagehand v3 Page
type V3Page = NonNullable<ReturnType<NonNullable<Stagehand['context']>['activePage']>>;

/**
 * StagehandBrowser - AI-powered browser using Stagehand v3
 *
 * Unlike AgentBrowser which uses refs ([ref=e1]), StagehandBrowser uses
 * natural language instructions for all interactions.
 *
 * Supports thread isolation via the threadIsolation config:
 * - 'none': All threads share the same page (default)
 * - 'context': Each thread gets its own page/tab
 */
export class StagehandBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'StagehandBrowser';
  override readonly provider = 'browserbase/stagehand';

  private stagehand: Stagehand | null = null;
  private stagehandConfig: StagehandBrowserConfig;

  /** Thread manager - narrowed type from base class */
  declare protected threadManager: StagehandThreadManager;

  private currentThreadId: string = DEFAULT_THREAD_ID;

  constructor(config: StagehandBrowserConfig = {}) {
    super(config);
    this.id = `stagehand-${Date.now()}`;
    this.stagehandConfig = config;

    // Initialize thread manager
    // Default to 'context' isolation so each thread gets its own browser page
    this.threadManager = new StagehandThreadManager({
      isolation: config.threadIsolation ?? 'context',
      logger: this.logger,
      // When a new thread session is created, notify listeners so screencast can start
      onSessionCreated: () => {
        // Trigger onBrowserReady callbacks - this allows ViewerRegistry to start screencast
        // for threads that just started using the browser
        this.notifyBrowserReady();
      },
    });
  }

  /**
   * Set the current thread ID for subsequent operations.
   * Tools should call this before executing browser actions.
   */
  setCurrentThread(threadId?: string): void {
    this.currentThreadId = threadId ?? DEFAULT_THREAD_ID;
  }

  /**
   * Get the current thread ID.
   */
  getCurrentThreadId(): string {
    return this.currentThreadId;
  }

  /**
   * Ensure browser is ready and thread session exists.
   * Creates a new page for the current thread if needed.
   */
  override async ensureReady(): Promise<void> {
    await super.ensureReady();

    // Ensure thread session exists for the current thread
    const isolation = this.threadManager.getIsolationMode();
    if (isolation !== 'none' && this.currentThreadId !== DEFAULT_THREAD_ID) {
      // This will create the session/page if it doesn't exist
      await this.getPageForThread(this.currentThreadId);
    }
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
      stagehandOptions.localBrowserLaunchOptions = {
        cdpUrl: await this.resolveCdpUrl(config.cdpUrl),
        headless: config.headless,
      };
    } else if (config.headless !== undefined && config.env !== 'BROWSERBASE') {
      stagehandOptions.localBrowserLaunchOptions = {
        headless: config.headless,
      };
    }

    this.stagehand = new Stagehand(stagehandOptions);
    await this.stagehand.init();

    // Register the Stagehand instance with the thread manager
    this.threadManager.setStagehand(this.stagehand as any);

    // Listen for browser/context close events to detect external closure
    // Cast to access Playwright's BrowserContext.on() which Stagehand wraps
    const context = this.stagehand.context as unknown as { on?: (event: string, cb: () => void) => void };
    if (context?.on) {
      context.on('close', () => {
        this.logger.debug?.('Browser context closed event received');
        this.handleBrowserDisconnected();
      });
    }
  }

  protected override async doClose(): Promise<void> {
    // Clean up all thread pages first
    await this.threadManager.destroyAll();

    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }

    // Reset thread state
    this.currentThreadId = DEFAULT_THREAD_ID;
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
      const url = pages[0]?.url();
      // Save URL for potential restore on relaunch
      if (url && url !== 'about:blank') {
        this.lastUrl = url;
      }
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
   * Handle browser disconnection by clearing internal state and calling base class.
   */
  override handleBrowserDisconnected(): void {
    this.stagehand = null;
    super.handleBrowserDisconnected();
  }

  /**
   * Create an error response from an exception.
   * Extends base class to add Stagehand-specific error handling.
   */
  protected override createErrorFromException(error: unknown, context: string): BrowserToolError {
    const msg = error instanceof Error ? error.message : String(error);

    // Check for Stagehand-specific "no actions found" errors
    if (msg.includes('No actions found') || msg.includes('Could not find')) {
      return this.createError(
        'element_not_found',
        `${context}: Could not find matching element or action.`,
        'Try rephrasing the instruction or use observe() to see available actions.',
      );
    }

    // Delegate to base class for common errors
    return super.createErrorFromException(error, context);
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
   * Get the current page from Stagehand v3, respecting thread isolation.
   * In v3, pages are accessed via stagehand.context.pages()
   */
  private getPage(): V3Page | null {
    if (!this.stagehand) return null;

    const isolation = this.threadManager.getIsolationMode();

    // If using thread isolation, get the page for the current thread
    if (isolation !== 'none' && this.currentThreadId !== DEFAULT_THREAD_ID) {
      const threadPage = this.threadManager.getPageForThread(this.currentThreadId);
      if (threadPage) {
        return threadPage as V3Page;
      }
    }

    // Fall back to the active page
    try {
      const context = this.stagehand.context;
      if (context) {
        // Try activePage() if available (Stagehand v3)
        if (typeof context.activePage === 'function') {
          const activePage = context.activePage();
          if (activePage) {
            return activePage as V3Page;
          }
        }
        // Fall back to first page if no active page
        const pages = context.pages();
        if (pages && pages.length > 0) {
          return pages[0] as V3Page;
        }
      }
    } catch {
      // Ignore errors - page may not be available
    }

    return null;
  }

  /**
   * Get the page for a specific thread, creating it if needed.
   * This is an async version that ensures the thread session exists.
   */
  async getPageForThread(threadId: string): Promise<V3Page | null> {
    if (!this.stagehand) return null;

    const isolation = this.threadManager.getIsolationMode();

    if (isolation === 'none') {
      return this.getPage();
    }

    // Get the manager for the thread (creates session if needed)
    const result = await this.threadManager.getManagerForThread(threadId);
    if (result) {
      // Result is either a V3Page (for context mode) or the Stagehand instance
      // Check if it's a page by looking for page-specific methods
      if (typeof (result as any).url === 'function') {
        return result as V3Page;
      }
    }

    // Fall back to the active page
    return this.getPage();
  }

  /**
   * Get a CDP session for the current page.
   * In Stagehand v3, we access the CDP session via page.getSessionForFrame()
   */
  private getCdpSession(): any {
    const page = this.getPage();
    return this.getCdpSessionForPage(page);
  }

  /**
   * Get a CDP session for a specific page.
   */
  private getCdpSessionForPage(page: V3Page | null): any {
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

  /**
   * Get a CDP session for a specific thread's page.
   */
  private async getCdpSessionForThread(threadId: string): Promise<any> {
    const page = await this.getPageForThread(threadId);
    return this.getCdpSessionForPage(page);
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
      // Pass page for thread isolation support
      const result = await stagehand.act(input.instruction, {
        variables: input.variables,
        timeout: input.timeout,
        page: page ?? undefined,
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
      // Pass page for thread isolation support
      const options: any = { page: page ?? undefined };
      const result = input.schema
        ? await stagehand.extract(input.instruction, input.schema as any, options)
        : await stagehand.extract(input.instruction, options);

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
      // Pass page for thread isolation support
      const options: any = { page: page ?? undefined };
      const actions = input.instruction
        ? await stagehand.observe(input.instruction, options)
        : await stagehand.observe(options);

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
      return this.createError('browser_error', 'Browser page not available.', 'Ensure the browser is launched.');
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
      return this.createError('browser_error', 'Browser page not available.', 'Ensure the browser is launched.');
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

  /**
   * Navigate to a URL (simple version). Used internally for restoring state on relaunch.
   */
  override async navigateTo(url: string): Promise<void> {
    const page = this.getPage();
    if (!page) return;

    try {
      await page.goto(url, {
        timeoutMs: this.config.timeout ?? 30000,
        waitUntil: 'domcontentloaded',
      });
    } catch {
      // Silently ignore navigation errors during restore
    }
  }

  // ---------------------------------------------------------------------------
  // Screencast (for Studio live view)
  // Uses Stagehand v3's native CDP access
  // ---------------------------------------------------------------------------

  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    const threadId = options?.threadId;
    const isolation = this.threadManager.getIsolationMode();

    // Only use thread-specific page if thread already has a session
    const hasExistingSession =
      isolation !== 'none' && threadId && threadId !== DEFAULT_THREAD_ID && this.threadManager.hasSession(threadId);

    // Get CDP session - use thread-specific page if session exists
    const cdpSession = hasExistingSession ? await this.getCdpSessionForThread(threadId) : this.getCdpSession();

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

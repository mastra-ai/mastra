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
import type { ActInput, ExtractInput, ObserveInput, NavigateInput, ScreenshotInput, TabsInput } from './schemas';
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
 * - 'none': All threads share the same Stagehand instance
 * - 'browser': Each thread gets its own Stagehand instance (separate browser)
 */
export class StagehandBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'StagehandBrowser';
  override readonly provider = 'browserbase/stagehand';

  private stagehand: Stagehand | null = null;
  private stagehandConfig: StagehandBrowserConfig;

  /** Thread manager - narrowed type from base class */
  declare protected threadManager: StagehandThreadManager;

  /** Active screencast stream for reconnection on tab changes */
  private activeScreencastStream: ScreencastStreamImpl | null = null;

  constructor(config: StagehandBrowserConfig = {}) {
    super(config);
    this.id = `stagehand-${Date.now()}`;
    this.stagehandConfig = config;

    // Initialize thread manager
    // Default to 'browser' isolation so each thread gets its own browser instance
    this.threadManager = new StagehandThreadManager({
      isolation: config.threadIsolation ?? 'browser',
      logger: this.logger,
      // When a new thread session is created, notify listeners so screencast can start
      onSessionCreated: () => {
        // Trigger onBrowserReady callbacks - this allows ViewerRegistry to start screencast
        // for threads that just started using the browser
        this.notifyBrowserReady();
      },
      // When a new browser is created for a thread, set up close listener
      onBrowserCreated: (stagehand, threadId) => {
        this.setupCloseListenerForThread(stagehand, threadId);
      },
    });
  }

  /**
   * Ensure browser is ready and thread session exists.
   * For 'browser' isolation, this creates a dedicated Stagehand instance for the thread.
   */
  override async ensureReady(): Promise<void> {
    // Always ensure the factory is set before any thread operations
    // This must happen before super.ensureReady() which may trigger doLaunch()
    this.threadManager.setCreateStagehand(() => this.createStagehandInstance());

    // Call super first - this will trigger doLaunch() if not already launched
    await super.ensureReady();

    // For 'browser' isolation, ensure thread session exists after browser is ready
    const isolation = this.getThreadIsolationMode();
    const threadId = this.getCurrentThread();
    if (isolation === 'browser' && threadId && threadId !== DEFAULT_THREAD_ID) {
      // This will create the Stagehand instance for this thread if needed
      await this.getStagehandForThread(threadId);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Build Stagehand options from config.
   */
  private async buildStagehandOptions(): Promise<any> {
    const config = this.stagehandConfig;

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

    return stagehandOptions;
  }

  /**
   * Create a new Stagehand instance with the current config.
   * Used by thread manager for 'browser' isolation mode.
   */
  private async createStagehandInstance(): Promise<Stagehand> {
    const { Stagehand } = await import('@browserbasehq/stagehand');
    const stagehandOptions = await this.buildStagehandOptions();
    const stagehand = new Stagehand(stagehandOptions);
    await stagehand.init();
    return stagehand;
  }

  protected override async doLaunch(): Promise<void> {
    const isolation = this.getThreadIsolationMode();

    // Set up the thread manager's factory function for creating new Stagehand instances
    this.threadManager.setCreateStagehand(() => this.createStagehandInstance());

    if (isolation === 'browser') {
      // For 'browser' isolation, don't launch a shared browser here.
      // Each thread will get its own Stagehand instance via getStagehandForThread().
      // We still need a placeholder so the base class knows we're "launched".
      this.logger.debug?.('Browser isolation mode - skipping shared browser launch');
      return;
    }

    // For 'none' isolation, launch a shared Stagehand instance
    this.stagehand = await this.createStagehandInstance();

    // Register the Stagehand instance with the thread manager
    this.threadManager.setStagehand(this.stagehand as any);

    // Listen for browser/context close events to detect external closure
    this.setupCloseListener(this.stagehand);
  }

  /**
   * Set up close event listener for a Stagehand instance.
   */
  private setupCloseListener(stagehand: Stagehand): void {
    const context = stagehand.context as unknown as { on?: (event: string, cb: () => void) => void };
    if (context?.on) {
      context.on('close', () => {
        this.logger.debug?.('Browser context closed event received');
        this.handleBrowserDisconnected();
      });
    }
  }

  /**
   * Set up close event listener for a thread's Stagehand instance.
   * This handles the case where a thread's browser is closed externally.
   */
  private setupCloseListenerForThread(stagehand: Stagehand, threadId: string): void {
    const context = stagehand.context as unknown as { on?: (event: string, cb: () => void) => void };
    if (context?.on) {
      context.on('close', () => {
        this.logger.debug?.(`Browser context closed for thread: ${threadId}`);
        this.handleThreadBrowserDisconnected(threadId);
      });
    }
  }

  /**
   * Handle browser disconnection for a specific thread.
   * Called when a thread's browser is closed externally.
   */
  private handleThreadBrowserDisconnected(threadId: string): void {
    this.threadManager.clearSession(threadId);
    this.logger.debug?.(`Cleared Stagehand session for thread: ${threadId}`);
    // Notify base class - this will trigger notifyBrowserClosed()
    super.handleBrowserDisconnected();
  }

  protected override async doClose(): Promise<void> {
    // Clean up all thread Stagehand instances first
    await this.threadManager.destroyAll();

    // Close the shared Stagehand instance if it exists
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }

    // Reset thread state
    this.setCurrentThread(undefined);
  }

  /**
   * Check if the browser is still alive by verifying the context and pages exist.
   * Called by base class ensureReady() to detect externally closed browsers.
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    const isolation = this.getThreadIsolationMode();

    if (isolation === 'browser') {
      // For 'browser' isolation, check if any thread browsers are running
      return this.threadManager.hasActiveThreadStagehands();
    }

    // For 'none' isolation, check the shared Stagehand instance
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
   * For 'browser' isolation, only clears the current thread's session (not all threads).
   */
  override handleBrowserDisconnected(): void {
    const isolation = this.threadManager.getIsolationMode();
    const threadId = this.getCurrentThread();

    if (isolation === 'browser' && threadId !== DEFAULT_THREAD_ID) {
      // Only clear the specific thread's session - other threads have independent browsers
      this.threadManager.clearSession(threadId);
      this.logger.debug?.(`Cleared Stagehand session for thread: ${threadId}`);
    } else {
      // For 'none' isolation or default thread, the shared stagehand is gone
      this.stagehand = null;
      this.threadManager.clearStagehand();
    }

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

  /**
   * Get the Stagehand instance for a thread, creating it if needed.
   * For 'browser' isolation, this creates a dedicated Stagehand instance.
   * For 'none' isolation, returns the shared instance.
   */
  private async getStagehandForThread(threadId: string | undefined): Promise<Stagehand | null> {
    const isolation = this.getThreadIsolationMode();

    if (isolation === 'none') {
      return this.stagehand;
    }

    if (!threadId || threadId === DEFAULT_THREAD_ID) {
      return this.stagehand;
    }

    // For 'browser' isolation, get or create the thread's Stagehand instance
    let stagehand = this.threadManager.getStagehandForThread(threadId);
    if (!stagehand) {
      // Create session which creates the Stagehand instance
      // The onBrowserCreated callback will set up the close listener
      await this.threadManager.getManagerForThread(threadId);
      stagehand = this.threadManager.getStagehandForThread(threadId);
    }

    return stagehand ?? null;
  }

  /**
   * Require a Stagehand instance for the current thread.
   * Throws if no instance is available.
   */
  private requireStagehand(): Stagehand {
    const threadId = this.getCurrentThread();
    const stagehand = this.threadManager.getStagehandForThread(threadId ?? '') ?? this.stagehand;

    if (!stagehand) {
      throw new Error('Browser not launched');
    }
    return stagehand;
  }

  /**
   * Get the current page from Stagehand v3, respecting thread isolation.
   */
  private getPage(): V3Page | null {
    const isolation = this.getThreadIsolationMode();
    const threadId = this.getCurrentThread();

    // For 'browser' isolation, get the thread's Stagehand's active page
    if (isolation === 'browser' && threadId && threadId !== DEFAULT_THREAD_ID) {
      const stagehand = this.threadManager.getStagehandForThread(threadId);
      if (stagehand?.context) {
        return stagehand.context.activePage() as V3Page | null;
      }
      return null;
    }

    // For 'none' isolation, use the shared Stagehand instance
    if (!this.stagehand) return null;

    try {
      const context = this.stagehand.context;
      if (context) {
        const activePage = context.activePage();
        if (activePage) {
          return activePage as V3Page;
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
   * Get the page for a specific thread, creating session if needed.
   */
  async getPageForThread(threadId: string): Promise<V3Page | null> {
    const isolation = this.threadManager.getIsolationMode();

    if (isolation === 'none') {
      return this.getPage();
    }

    // For 'browser' isolation, get the thread's Stagehand instance
    const stagehand = await this.getStagehandForThread(threadId);
    if (stagehand?.context) {
      return stagehand.context.activePage() as V3Page | null;
    }

    return null;
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
  // Tab Management
  // ---------------------------------------------------------------------------

  /**
   * Manage browser tabs - list, create, switch, close
   */
  async tabs(
    input: TabsInput,
  ): Promise<
    | { success: true; tabs?: Array<{ index: number; url: string; title: string; active: boolean }>; hint: string }
    | { success: true; index?: number; url?: string; title?: string; remaining?: number; hint: string }
    | BrowserToolError
  > {
    const stagehand = this.requireStagehand();
    const context = stagehand.context;

    if (!context) {
      return this.createError('browser_error', 'Browser context not available.', 'Ensure the browser is launched.');
    }

    try {
      switch (input.action) {
        case 'list': {
          const pages = context.pages();
          const activePage = context.activePage();
          const tabs = await Promise.all(
            pages.map(async (page, index) => ({
              index,
              url: page.url(),
              title: await page.title(),
              active: page === activePage,
            })),
          );
          return {
            success: true,
            tabs,
            hint: 'Use stagehand_tabs with action:"switch" and index to change tabs.',
          };
        }

        case 'new': {
          const newPage = await context.newPage(input.url);
          // newPage automatically becomes active in Stagehand
          await this.reconnectScreencast('new tab via tool');
          return {
            success: true,
            index: context.pages().length - 1,
            url: newPage.url(),
            title: await newPage.title(),
            hint: 'New tab opened. Use stagehand_observe to discover actions.',
          };
        }

        case 'switch': {
          if (input.index === undefined) {
            return this.createError(
              'browser_error',
              'Tab index required for switch action.',
              'Provide index parameter.',
            );
          }
          const pages = context.pages();
          if (input.index < 0 || input.index >= pages.length) {
            return this.createError(
              'browser_error',
              `Invalid tab index: ${input.index}. Valid range: 0-${pages.length - 1}`,
              'Use stagehand_tabs with action:"list" to see available tabs.',
            );
          }
          const targetPage = pages[input.index]!;
          context.setActivePage(targetPage);
          await this.reconnectScreencast('tab switch via tool');
          return {
            success: true,
            index: input.index,
            url: targetPage.url(),
            title: await targetPage.title(),
            hint: 'Tab switched. Use stagehand_observe to discover actions.',
          };
        }

        case 'close': {
          const pages = context.pages();
          const indexToClose = input.index ?? pages.findIndex(p => p === context.activePage());
          if (indexToClose < 0 || indexToClose >= pages.length) {
            return this.createError(
              'browser_error',
              `Invalid tab index: ${indexToClose}`,
              'Use stagehand_tabs with action:"list" to see available tabs.',
            );
          }
          const pageToClose = pages[indexToClose]!;
          await pageToClose.close();
          await this.reconnectScreencast('tab close via tool');
          const remainingPages = context.pages();
          return {
            success: true,
            remaining: remainingPages.length,
            hint:
              remainingPages.length > 0 ? 'Tab closed. Use stagehand_observe to see current tab.' : 'All tabs closed.',
          };
        }

        default:
          return this.createError(
            'browser_error',
            `Unknown tabs action: ${(input as any).action}`,
            'Use "list", "new", "switch", or "close".',
          );
      }
    } catch (error) {
      return this.createErrorFromException(error, 'Tabs');
    }
  }

  // ---------------------------------------------------------------------------
  // URL Tracking (for Studio browser view)
  // ---------------------------------------------------------------------------

  override async getCurrentUrl(threadId?: string): Promise<string | null> {
    // Don't try to get URL if browser isn't running - this can be called
    // before launch (e.g., by BrowserContextProcessor)
    if (!this.isBrowserRunning()) {
      return null;
    }

    // Use the thread-specific page if provided
    const effectiveThreadId = threadId ?? this.getCurrentThread();

    // For 'browser' isolation, check if we have an existing session first
    // Don't create a new session just to get the URL
    const isolation = this.threadManager.getIsolationMode();
    if (isolation === 'browser' && effectiveThreadId) {
      const stagehand = this.threadManager.getStagehandForThread(effectiveThreadId);
      if (!stagehand?.context) {
        return null; // No session yet, don't create one
      }
      const page = stagehand.context.activePage() as V3Page | null;
      const url = page?.url() ?? null;
      // Save URL for potential restore on relaunch (before external close)
      if (url && url !== 'about:blank') {
        this.threadManager.updateLastUrl(effectiveThreadId, url);
      }
      return url;
    }

    // For 'none' isolation, use the shared page
    const page = this.getPage();
    if (!page) return null;

    try {
      const url = page.url();
      // Save URL for potential restore on relaunch (before external close)
      if (url && url !== 'about:blank') {
        this.lastUrl = url;
      }
      return url;
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

    // Create a CDP session provider that gets a fresh session for the current page
    // On reconnect, this will get a fresh CDP session for whatever page is currently active
    const provider = {
      getCdpSession: async () => {
        // Try Stagehand's page tracking first
        const page = await this.getPageForThread(threadId ?? '');
        if (page) {
          return this.getCdpSessionForPage(page);
        }

        // Fallback: use CDP directly to find the active target
        // This handles cases where Stagehand doesn't track the page (e.g., target="_blank" links)
        const stagehand = await this.getStagehandForThread(threadId);
        if (!stagehand?.context) {
          throw new Error('No Stagehand context available');
        }

        const context = stagehand.context as any;
        const conn = context._conn ?? context.conn ?? context.connection;
        if (!conn) {
          throw new Error('No CDP connection available');
        }

        // Get all page targets and use the most recent one
        const { targetInfos } = await conn.send('Target.getTargets');
        const pageTargets = targetInfos.filter((t: any) => t.type === 'page' && t.attached);

        if (pageTargets.length === 0) {
          throw new Error('No page targets available');
        }

        // Use the last page target (most recently created)
        const targetInfo = pageTargets[pageTargets.length - 1];

        // Attach to this target to get a CDP session
        const { sessionId } = await conn.send('Target.attachToTarget', {
          targetId: targetInfo.targetId,
          flatten: true,
        });

        // Return the session
        const session = conn.getSession?.(sessionId) ?? conn;
        return session;
      },
      isBrowserRunning: () => this.isBrowserRunning(),
    };

    const stream = new ScreencastStreamImpl(provider, options);

    // Store the stream for potential future reconnection
    this.activeScreencastStream = stream;

    await stream.start();

    // Set up tab change detection
    await this.setupTabChangeDetection(threadId, stream);

    // Clean up when screencast stops
    stream.once('stop', () => {
      if (this.activeScreencastStream === stream) {
        this.activeScreencastStream = null;
      }
    });

    return stream as unknown as ScreencastStream;
  }

  /** Debounce timer for tab change reconnection */
  private tabChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Set up listeners to detect tab changes and reconnect the screencast.
   * Uses CDP Target events since Stagehand doesn't expose page lifecycle events.
   */
  private async setupTabChangeDetection(threadId: string | undefined, stream: ScreencastStreamImpl): Promise<void> {
    const stagehand = await this.getStagehandForThread(threadId);
    if (!stagehand?.context) return;

    // Access the root CDP connection from the context
    const context = stagehand.context as any;
    const connection = context._conn ?? context.conn ?? context.connection ?? context._connection;

    if (!connection) {
      this.logger.debug?.('No CDP connection available for tab change detection');
      return;
    }

    this.logger.debug?.('Setting up tab change detection via CDP');

    // Listen for new tab creation
    const onTargetCreated = (params: { targetInfo: { type: string; targetId: string; url: string } }) => {
      if (params.targetInfo.type !== 'page') return;

      this.logger.debug?.(`New page target created: ${params.targetInfo.url}`);

      // Debounce to avoid rapid reconnects
      if (this.tabChangeDebounceTimer) {
        clearTimeout(this.tabChangeDebounceTimer);
      }
      this.tabChangeDebounceTimer = setTimeout(() => {
        this.tabChangeDebounceTimer = null;
        void this.reconnectScreencast('new tab');
      }, 300);
    };

    // Listen for tab destruction
    const onTargetDestroyed = (_params: { targetId: string }) => {
      this.logger.debug?.('Page target destroyed');

      if (this.tabChangeDebounceTimer) {
        clearTimeout(this.tabChangeDebounceTimer);
      }
      this.tabChangeDebounceTimer = setTimeout(() => {
        this.tabChangeDebounceTimer = null;
        void this.reconnectScreencast('tab closed');
      }, 300);
    };

    try {
      connection.on?.('Target.targetCreated', onTargetCreated);
      connection.on?.('Target.targetDestroyed', onTargetDestroyed);

      // Clean up listeners when stream stops
      stream.once('stop', () => {
        if (this.tabChangeDebounceTimer) {
          clearTimeout(this.tabChangeDebounceTimer);
          this.tabChangeDebounceTimer = null;
        }
        connection.off?.('Target.targetCreated', onTargetCreated);
        connection.off?.('Target.targetDestroyed', onTargetDestroyed);
      });
    } catch (error) {
      this.logger.debug?.('Failed to set up tab change detection', error);
    }
  }

  /**
   * Reconnect the active screencast to pick up tab changes.
   */
  private async reconnectScreencast(reason: string): Promise<void> {
    const stream = this.activeScreencastStream;
    if (!stream || !stream.isActive()) {
      return;
    }

    // Check if browser is still running before attempting reconnect
    if (!this.isBrowserRunning()) {
      this.logger.debug?.('Skipping screencast reconnect - browser not running');
      return;
    }

    this.logger.debug?.(`Reconnecting screencast: ${reason}`);

    try {
      // Small delay to let tab state settle
      await new Promise(resolve => setTimeout(resolve, 150));
      await stream.reconnect();
    } catch (error) {
      this.logger.debug?.('Screencast reconnect failed', error);
    }
  }

  // NOTE: Manual tab switching in browser UI is not fully supported.
  // Stagehand v3 does not track pages opened via browser UI (only pages created through its API).
  // We've requested this feature from Browserbase - see Notion doc for details.

  // ---------------------------------------------------------------------------
  // Event Injection (for Studio live view interactivity)
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(event: MouseEventParams, threadId?: string): Promise<void> {
    // Use the provided threadId, or fall back to the current thread
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const page = await this.getPageForThread(effectiveThreadId ?? '');
    const cdpSession = this.getCdpSessionForPage(page);

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

  override async injectKeyboardEvent(event: KeyboardEventParams, threadId?: string): Promise<void> {
    // Use the provided threadId, or fall back to the current thread
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const page = await this.getPageForThread(effectiveThreadId ?? '');
    const cdpSession = this.getCdpSessionForPage(page);

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

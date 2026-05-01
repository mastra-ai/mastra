/**
 * StagehandBrowser - AI-powered browser automation using Stagehand v3
 *
 * Uses natural language instructions for browser interactions.
 * Fundamentally different from AgentBrowser's deterministic refs approach.
 *
 * Stagehand v3 is CDP-native and provides direct CDP access for screencast/input injection.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { Stagehand } from '@browserbasehq/stagehand';
import { MastraBrowser, ScreencastStreamImpl, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type {
  BrowserState,
  BrowserTabState,
  BrowserToolError,
  ScreencastOptions,
  ScreencastStream,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { ActInput, ExtractInput, ObserveInput, NavigateInput, TabsInput } from './schemas';
import { StagehandThreadManager } from './thread-manager';
import { createStagehandTools } from './tools';
import type { StagehandBrowserConfig, StagehandAction } from './types';
import { getStagehandChromePid, patchProfileExitType } from './utils';

// Type for Stagehand v3 Page
type V3Page = NonNullable<ReturnType<NonNullable<Stagehand['context']>['activePage']>>;

/**
 * StagehandBrowser - AI-powered browser using Stagehand v3
 *
 * Unlike AgentBrowser which uses refs ([ref=e1]), StagehandBrowser uses
 * natural language instructions for all interactions.
 *
 * Supports thread scope via the scope config:
 * - 'shared': All threads share the same Stagehand instance
 * - 'thread': Each thread gets its own Stagehand instance (separate browser)
 */
export class StagehandBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'StagehandBrowser';
  override readonly provider = 'browserbase/stagehand';

  /** Shared Stagehand instance (for 'shared' scope) - narrowed type from base class */
  declare protected sharedManager: Stagehand | null;
  private stagehandConfig: StagehandBrowserConfig;

  /** Thread manager - narrowed type from base class */
  declare protected threadManager: StagehandThreadManager;

  /** Debounce timers per thread for tab change reconnection */
  private tabChangeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: StagehandBrowserConfig = {}) {
    super(config);
    this.id = `stagehand-${Date.now()}`;
    this.stagehandConfig = config;

    // Default to 'shared' when cdpUrl is provided (connecting to existing browser)
    // Default to 'thread' otherwise (launching new browsers per thread)
    const effectiveScope = config.cdpUrl ? (config.scope ?? 'shared') : (config.scope ?? 'thread');

    // Initialize thread manager
    this.threadManager = new StagehandThreadManager({
      scope: effectiveScope,
      logger: this.logger,
      // When a new thread session is created, notify listeners so screencast can start
      onSessionCreated: session => {
        // Trigger onBrowserReady callbacks for this specific thread
        // This allows ViewerRegistry to start screencast for just this thread
        this.notifyBrowserReady(session.threadId);
      },
      // When a new browser is created for a thread, set up close listener
      onBrowserCreated: (stagehand, threadId) => {
        this.setupCloseListener(stagehand, () => this.handleThreadBrowserDisconnected(threadId), threadId);
      },
    });
  }

  /**
   * Ensure browser is ready and thread session exists.
   * For 'thread' scope, this creates a dedicated Stagehand instance for the thread.
   */
  override async ensureReady(): Promise<void> {
    // Always ensure the factory is set before any thread operations
    // This must happen before super.ensureReady() which may trigger doLaunch()
    this.threadManager.setCreateStagehand(() => this.createStagehandInstance());

    // Call super first - this will trigger doLaunch() if not already launched
    await super.ensureReady();

    // For 'thread' scope, ensure thread session exists after browser is ready
    const scope = this.getScope();
    const threadId = this.getCurrentThread();
    if (scope === 'thread' && threadId && threadId !== DEFAULT_THREAD_ID) {
      // This will create the Stagehand instance for this thread if needed
      await this.getManagerForThread(threadId);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Build Stagehand options from config.
   * Returns the configuration object expected by Stagehand constructor.
   */
  private async buildStagehandOptions(): Promise<{
    env: 'LOCAL' | 'BROWSERBASE';
    model?: string;
    selfHeal?: boolean;
    domSettleTimeoutMs?: number;
    verbose?: 0 | 1 | 2;
    systemPrompt?: string;
    apiKey?: string;
    projectId?: string;
    localBrowserLaunchOptions?: {
      cdpUrl?: string;
      headless?: boolean;
      viewport?: { width: number; height: number };
      userDataDir?: string;
      executablePath?: string;
      preserveUserDataDir?: boolean;
    };
  }> {
    const config = this.stagehandConfig;

    const stagehandOptions: {
      env: 'LOCAL' | 'BROWSERBASE';
      model?: string;
      selfHeal?: boolean;
      domSettleTimeoutMs?: number;
      verbose?: 0 | 1 | 2;
      systemPrompt?: string;
      apiKey?: string;
      projectId?: string;
      localBrowserLaunchOptions?: {
        cdpUrl?: string;
        headless?: boolean;
        viewport?: { width: number; height: number };
        userDataDir?: string;
        executablePath?: string;
        preserveUserDataDir?: boolean;
      };
    } = {
      env: config.env ?? 'LOCAL',
      // v3 uses "provider/model" format
      model: typeof config.model === 'string' ? config.model : config.model?.modelName,
      selfHeal: config.selfHeal ?? true,
      domSettleTimeoutMs: config.domSettleTimeout,
      verbose: (config.verbose ?? 1) as 0 | 1 | 2,
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

    // Ensure profile directory exists if specified (Stagehand doesn't create it)
    if (config.profile && !existsSync(config.profile)) {
      mkdirSync(config.profile, { recursive: true });
    }

    // Handle CDP URL for local browser with custom endpoint
    // Stagehand requires a WebSocket URL, so resolve HTTP URLs to WebSocket URLs
    if (config.cdpUrl && config.env !== 'BROWSERBASE') {
      const resolvedUrl = await this.resolveCdpUrl(config.cdpUrl);
      const wsUrl = await this.resolveWebSocketUrl(resolvedUrl);
      stagehandOptions.localBrowserLaunchOptions = {
        cdpUrl: wsUrl,
        headless: this.headless,
        viewport: config.viewport,
        userDataDir: config.profile,
        executablePath: config.executablePath,
        preserveUserDataDir: config.preserveUserDataDir,
      };
    } else if (config.env !== 'BROWSERBASE') {
      stagehandOptions.localBrowserLaunchOptions = {
        headless: this.headless,
        viewport: config.viewport,
        userDataDir: config.profile,
        executablePath: config.executablePath,
        preserveUserDataDir: config.preserveUserDataDir,
      };
    }

    return stagehandOptions;
  }

  /**
   * Create a new Stagehand instance with the current config.
   * Used by thread manager for 'thread' scope.
   */
  private async createStagehandInstance(): Promise<Stagehand> {
    const stagehandOptions = await this.buildStagehandOptions();
    const stagehand = new Stagehand(stagehandOptions);
    await stagehand.init();
    return stagehand;
  }

  protected override async doLaunch(): Promise<void> {
    const scope = this.getScope();

    // Set up the thread manager's factory function for creating new Stagehand instances
    this.threadManager.setCreateStagehand(() => this.createStagehandInstance());

    if (scope === 'thread') {
      // For 'thread' scope, don't launch a shared browser here.
      // Each thread will get its own Stagehand instance via getManagerForThread().
      // We still need a placeholder so the base class knows we're "launched".

      return;
    }

    // For 'shared' scope, launch a shared Stagehand instance
    this.sharedManager = await this.createStagehandInstance();

    // Register the Stagehand instance with the thread manager
    this.threadManager.setSharedManager(this.sharedManager as any);

    // Listen for browser/context close events to detect external closure
    this.setupCloseListener(this.sharedManager, () => this.handleBrowserDisconnected());
  }

  /**
   * Set up close event listener for a shared Stagehand instance.
   * Listens to both context and page close events for robust detection.
   */
  /**
   * Set up a CDP-based close listener for a Stagehand instance.
   *
   * Tracks page targets via CDP `Target.targetCreated` / `Target.targetDestroyed`.
   * When all page targets are gone the `onDisconnect` callback fires. This is more
   * reliable than Playwright's `context.close` / `page.close` events which don't
   * fire when Chrome is killed externally (SIGTERM/SIGKILL).
   */
  private setupCloseListener(stagehand: Stagehand, onDisconnect: () => void, threadId?: string): void {
    const chromePid = getStagehandChromePid(stagehand);
    // Store PID so the base class can kill the process group on disconnect/close
    if (chromePid != null) {
      if (threadId) {
        this.threadBrowserPids.set(threadId, chromePid);
      } else {
        this.sharedBrowserPid = chromePid;
      }
    }

    let disconnectHandled = false;
    const handleDisconnect = () => {
      if (disconnectHandled) return;
      disconnectHandled = true;
      onDisconnect();
    };

    try {
      const stagehandAny = stagehand as any;
      const conn = stagehandAny.ctx?.conn;
      if (!conn?.on) return;

      // Track page targets — when all are destroyed, browser is closed
      const pageTargets = new Set<string>();

      const context = stagehand.context;
      if (context) {
        for (const page of context.pages?.() ?? []) {
          const targetId = (page as any)._targetId ?? (page as any).targetId;
          if (targetId) pageTargets.add(targetId);
        }
      }

      conn.on('Target.targetCreated', (params: { targetInfo: { targetId: string; type: string } }) => {
        if (params.targetInfo.type === 'page') pageTargets.add(params.targetInfo.targetId);
      });

      conn.on('Target.targetDestroyed', (params: { targetId: string }) => {
        if (pageTargets.has(params.targetId)) {
          pageTargets.delete(params.targetId);
          if (pageTargets.size === 0) handleDisconnect();
        }
      });
    } catch {
      // Ignore errors setting up close listener
    }
  }

  protected override async doClose(): Promise<void> {
    // Clean up all thread Stagehand instances first
    await this.threadManager.destroyAllSessions();

    // Close the shared Stagehand instance if it exists
    if (this.sharedManager) {
      await this.sharedManager.close();
      this.sharedManager = null;
    }

    // Reset thread state
    this.setCurrentThread(undefined);

    // Stagehand uses chrome-launcher which sends SIGKILL, racing with Chrome's
    // Preferences flush. Patch exit_type so the next launch doesn't show
    // the "Chrome didn't shut down correctly" dialog.
    // Note: Chrome only creates Default/Preferences after extended use (e.g.,
    // logging in), not on first launch. Short-lived profiles won't have this file.
    this.patchExitType();
  }

  override handleBrowserDisconnected(): void {
    super.handleBrowserDisconnected();
    this.patchExitType();
  }

  protected override handleThreadBrowserDisconnected(threadId: string): void {
    super.handleThreadBrowserDisconnected(threadId);
    this.patchExitType();
  }

  override async closeThreadSession(threadId: string): Promise<void> {
    await super.closeThreadSession(threadId);
    this.patchExitType();
  }

  private patchExitType(): void {
    if (!this.config.profile) return;
    patchProfileExitType(this.config.profile, this.logger);
  }

  /**
   * Check if the browser is still alive by verifying the context and pages exist.
   * Called by base class ensureReady() to detect externally closed browsers.
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    const scope = this.getScope();

    if (scope === 'thread') {
      // For 'thread' scope, check if any thread browsers are running
      return this.threadManager.hasActiveThreadManagers();
    }

    // For 'shared' scope, check the shared Stagehand instance
    if (!this.sharedManager) {
      return false;
    }
    try {
      const context = this.sharedManager.context;
      if (!context) {
        return false;
      }
      const pages = context.pages();
      if (!pages || pages.length === 0) {
        return false;
      }
      // Will throw if browser is disconnected
      const url = pages[0]?.url();
      // Save browser state for potential restore on relaunch
      if (url && url !== 'about:blank') {
        const state = this.getBrowserStateFromStagehand(this.sharedManager);
        if (state) {
          this.lastBrowserState = state;
        }
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
   * For 'thread' scope, this creates a dedicated Stagehand instance.
   * For 'shared' scope, returns the shared instance.
   */
  async getManagerForThread(threadId?: string): Promise<Stagehand | null> {
    const scope = this.getScope();

    if (scope === 'shared') {
      return this.sharedManager;
    }

    if (!threadId || threadId === DEFAULT_THREAD_ID) {
      return this.sharedManager;
    }

    // For 'thread' scope, get or create the thread's Stagehand instance
    let stagehand = this.threadManager.getExistingManagerForThread(threadId);
    if (!stagehand) {
      // Create session which creates the Stagehand instance
      // The onBrowserCreated callback will set up the close listener
      await this.threadManager.getManagerForThread(threadId);
      stagehand = this.threadManager.getExistingManagerForThread(threadId);
    }

    return stagehand ?? null;
  }

  /**
   * Require a Stagehand instance for the given or current thread.
   * Throws if no instance is available.
   * @param explicitThreadId - Optional thread ID to use instead of getCurrentThread()
   *                           Use this to avoid race conditions in concurrent tool calls.
   */
  private requireStagehand(explicitThreadId?: string): Stagehand {
    const threadId = explicitThreadId ?? this.getCurrentThread();
    const stagehand = this.threadManager.getExistingManagerForThread(threadId) ?? this.sharedManager;

    if (!stagehand) {
      throw new Error('Browser not launched');
    }
    return stagehand;
  }

  /**
   * Get the current page from Stagehand v3, respecting thread scope.
   * @param explicitThreadId - Optional thread ID to use instead of getCurrentThread()
   *                           Use this to avoid race conditions in concurrent tool calls.
   */
  private getPage(explicitThreadId?: string): V3Page | null {
    const scope = this.getScope();
    const threadId = explicitThreadId ?? this.getCurrentThread();

    // For 'thread' scope, get the thread's Stagehand's active page
    if (scope === 'thread' && threadId && threadId !== DEFAULT_THREAD_ID) {
      const stagehand = this.threadManager.getExistingManagerForThread(threadId);
      if (stagehand?.context) {
        return stagehand.context.activePage() as V3Page | null;
      }
      return null;
    }

    // For 'shared' scope, use the shared Stagehand instance
    if (!this.sharedManager) return null;

    try {
      const context = this.sharedManager.context;
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
   * Get the active page for a thread (implements abstract method from base class).
   */
  protected async getActivePage(threadId?: string): Promise<V3Page | null> {
    return this.getPage(threadId);
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
   * @param input - Action input
   * @param threadId - Optional thread ID for thread-safe operation
   */
  async act(
    input: ActInput,
    threadId?: string,
  ): Promise<{ success: true; message?: string; action?: string; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand(threadId);
    const page = this.getPage(threadId);
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.act(instruction, options?)
      // Pass page for thread scope support
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
   * @param input - Extract input
   * @param threadId - Optional thread ID for thread-safe operation
   */
  async extract(
    input: ExtractInput,
    threadId?: string,
  ): Promise<{ success: true; data: unknown; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand(threadId);
    const page = this.getPage(threadId);
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.extract(instruction, schema?, options?)
      // Pass page for thread scope support
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
   * @param input - Observe input
   * @param threadId - Optional thread ID for thread-safe operation
   */
  async observe(
    input: ObserveInput,
    threadId?: string,
  ): Promise<{ success: true; actions: StagehandAction[]; url: string; hint: string } | BrowserToolError> {
    const stagehand = this.requireStagehand(threadId);
    const page = this.getPage(threadId);
    const url = page?.url() ?? '';

    try {
      // v3 API: stagehand.observe() or stagehand.observe(instruction, options?)
      // Pass page for thread scope support
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
   * @param input - Navigate input
   * @param threadId - Optional thread ID for thread-safe operation
   */
  async navigate(
    input: NavigateInput,
    threadId?: string,
  ): Promise<{ success: true; url: string; title: string; hint: string } | BrowserToolError> {
    const page = this.getPage(threadId);

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

  // ---------------------------------------------------------------------------
  // Tab Management
  // ---------------------------------------------------------------------------

  /**
   * Manage browser tabs - list, create, switch, close
   * @param input - Tabs input
   * @param threadId - Optional thread ID for thread-safe operation
   */
  async tabs(
    input: TabsInput,
    threadId?: string,
  ): Promise<
    | { success: true; tabs?: Array<{ index: number; url: string; title: string; active: boolean }>; hint: string }
    | { success: true; index?: number; url?: string; title?: string; remaining?: number; hint: string }
    | BrowserToolError
  > {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const stagehand = this.requireStagehand(effectiveThreadId);
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
          await this.reconnectScreencastForThread(effectiveThreadId, 'new tab via tool');
          // Save state after new tab
          this.updateSessionBrowserState(effectiveThreadId);
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
          const targetUrl = targetPage.url();
          context.setActivePage(targetPage);
          await this.reconnectScreencastForThread(effectiveThreadId, 'tab switch via tool');
          // Emit URL directly since we have the target page
          const streamKey = this.getStreamKey(effectiveThreadId);
          const stream = this.activeScreencastStreams.get(streamKey);
          if (targetUrl && stream?.isActive()) {
            stream.emitUrl(targetUrl);
          }
          // Save state after switch (captures activeIndex change)
          this.updateSessionBrowserState(effectiveThreadId);
          return {
            success: true,
            index: input.index,
            url: targetUrl,
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
          await this.reconnectScreencastForThread(effectiveThreadId, 'tab close via tool');
          // Save state AFTER close (remaining tabs)
          this.updateSessionBrowserState(effectiveThreadId);
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

    // For 'thread' scope, check if we have an existing session first
    // Don't create a new session just to get the URL
    const scope = this.threadManager.getScope();
    if (scope === 'thread' && effectiveThreadId) {
      const stagehand = this.threadManager.getExistingManagerForThread(effectiveThreadId);
      if (!stagehand?.context) {
        return null; // No session yet, don't create one
      }
      const page = stagehand.context.activePage() as V3Page | null;
      const url = page?.url() ?? null;
      // Save browser state for potential restore on relaunch (before external close)
      if (url && url !== 'about:blank') {
        const state = this.getBrowserStateFromStagehand(stagehand);
        if (state) {
          this.threadManager.updateBrowserState(effectiveThreadId, state);
        }
      }
      return url;
    }

    // For 'shared' scope, use the shared page
    const page = this.getPage();
    if (!page) return null;

    try {
      const url = page.url();
      // Save browser state for potential restore on relaunch (before external close)
      if (url && url !== 'about:blank') {
        const state = this.getBrowserStateFromStagehand(this.sharedManager);
        if (state) {
          this.lastBrowserState = state;
        }
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

  /**
   * Get the current browser state (all tabs and active tab index).
   */
  override async getBrowserState(threadId?: string): Promise<BrowserState | null> {
    if (!this.isBrowserRunning()) {
      return null;
    }
    try {
      const scope = this.threadManager.getScope();
      const effectiveThreadId = threadId ?? this.getCurrentThread();

      if (scope === 'thread' && effectiveThreadId) {
        const stagehand = this.threadManager.getExistingManagerForThread(effectiveThreadId);
        if (!stagehand) return null;
        return this.getBrowserStateFromStagehand(stagehand);
      }

      return this.getBrowserStateFromStagehand(this.sharedManager);
    } catch {
      return null;
    }
  }

  /**
   * Get browser state for a thread (implements abstract method from base class).
   * Sync version that uses existing manager lookup without creating sessions.
   */
  protected getBrowserStateForThread(threadId?: string): BrowserState | null {
    const effectiveThreadId = threadId ?? this.getCurrentThread() ?? DEFAULT_THREAD_ID;
    const stagehand = this.threadManager.getExistingManagerForThread(effectiveThreadId);
    return this.getBrowserStateFromStagehand(stagehand);
  }

  /**
   * Get browser state from a specific Stagehand instance.
   */
  private getBrowserStateFromStagehand(stagehand: Stagehand | null): BrowserState | null {
    if (!stagehand?.context) return null;

    try {
      const pages = stagehand.context.pages();
      const activePage = stagehand.context.activePage();
      let activeIndex = 0;

      const tabs: BrowserTabState[] = pages.map((page, index) => {
        if (page === activePage) {
          activeIndex = index;
        }
        return { url: page.url() };
      });

      return {
        tabs,
        activeTabIndex: activeIndex,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all open tabs with their URLs and titles.
   */
  override async getTabState(threadId?: string): Promise<BrowserTabState[]> {
    const state = await this.getBrowserState(threadId);
    return state?.tabs ?? [];
  }

  /**
   * Get the active tab index.
   */
  override async getActiveTabIndex(threadId?: string): Promise<number> {
    const state = await this.getBrowserState(threadId);
    return state?.activeTabIndex ?? 0;
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
        const page = await this.threadManager.getPageForThread(threadId);
        if (!page) {
          throw new Error('No page available for screencast');
        }

        const session = this.getCdpSessionForPage(page);
        if (!session) {
          throw new Error('No CDP session available for page');
        }

        return session;
      },
      isBrowserRunning: () => this.isBrowserRunning(),
    };

    const stream = new ScreencastStreamImpl(provider, options);

    // Store the stream for potential future reconnection - keyed by thread
    const streamKey = this.getStreamKey(threadId);
    this.activeScreencastStreams.set(streamKey, stream);

    await stream.start();

    // Set up tab change detection
    await this.setupTabChangeDetection(threadId, stream);

    // Clean up when screencast stops
    stream.once('stop', () => {
      // Remove from streams map using captured key
      if (this.activeScreencastStreams.get(streamKey) === stream) {
        this.activeScreencastStreams.delete(streamKey);
      }
      // Clear debounce timer for this thread
      const timer = this.tabChangeDebounceTimers.get(streamKey);
      if (timer) {
        clearTimeout(timer);
        this.tabChangeDebounceTimers.delete(streamKey);
      }
    });

    return stream as unknown as ScreencastStream;
  }

  /**
   * Set up listeners to detect tab changes and reconnect the screencast.
   * Uses CDP Target events since Stagehand doesn't expose page lifecycle events.
   */
  private async setupTabChangeDetection(threadId: string | undefined, stream: ScreencastStreamImpl): Promise<void> {
    const stagehand = await this.getManagerForThread(threadId);
    if (!stagehand?.context) return;

    // Use Stagehand's public CDP connection API
    const connection = stagehand.context.conn;

    if (!connection) {
      this.logger.debug?.('No CDP connection available for tab change detection');
      return;
    }

    // Track targetId -> sessionId for manual tab registration
    const targetSessions = new Map<string, string>();

    // Debounce timer for target info changes (separate from tab change timer)
    let targetInfoDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Helper to check if Stagehand is tracking a target
    const isTrackedByStagehand = (targetId: string): boolean => {
      const pages = stagehand.context?.pages() || [];
      return pages.some(p => p.targetId() === targetId);
    };

    // Get the stream key for this thread's debounce timer
    const streamKey = this.getStreamKey(threadId);

    // Listen for new tab creation
    const onTargetCreated = (params: { targetInfo: { type: string; targetId: string; url: string } }) => {
      if (params.targetInfo.type !== 'page') return;

      // Debounce to avoid rapid reconnects (per-thread timer)
      const existingTimer = this.tabChangeDebounceTimers.get(streamKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      this.tabChangeDebounceTimers.set(
        streamKey,
        setTimeout(() => {
          this.tabChangeDebounceTimers.delete(streamKey);
          void this.reconnectScreencastForThread(threadId, 'new tab');
          // Re-setup navigation listener for the new active page
          void setupPageNavigationListener();
          // Note: State is saved via tool handlers (new/switch/close), not CDP events
        }, 300),
      );
    };

    // Listen for target attached (to capture sessionId for later registration)
    const onTargetAttached = (params: {
      sessionId: string;
      targetInfo: { type: string; targetId: string; url: string };
      waitingForDebugger?: boolean;
    }) => {
      if (params.targetInfo.type !== 'page') return;
      // Always store the sessionId - we may need it for manual registration
      targetSessions.set(params.targetInfo.targetId, params.sessionId);
    };

    // Listen for target info changes (URL updates after navigation)
    // Store latest params for debounced handler
    let pendingTargetInfo: { targetInfo: { type: string; targetId: string; url: string } } | null = null;

    const onTargetInfoChanged = (params: { targetInfo: { type: string; targetId: string; url: string } }) => {
      if (params.targetInfo.type !== 'page') return;

      // Skip if Stagehand already tracks this target
      if (isTrackedByStagehand(params.targetInfo.targetId)) return;

      const sessionId = targetSessions.get(params.targetInfo.targetId);
      if (!sessionId) return;

      // Debounce to handle rapid URL changes
      pendingTargetInfo = params;
      if (targetInfoDebounceTimer) {
        clearTimeout(targetInfoDebounceTimer);
      }
      targetInfoDebounceTimer = setTimeout(async () => {
        targetInfoDebounceTimer = null;
        if (!pendingTargetInfo) return;

        const info = pendingTargetInfo.targetInfo;
        const sid = targetSessions.get(info.targetId);
        pendingTargetInfo = null;

        // Re-check if already tracked after debounce
        if (isTrackedByStagehand(info.targetId) || !sid) return;

        // Try to register with Stagehand
        const contextAny = stagehand.context as unknown as {
          onAttachedToTarget?: (
            info: { type: string; targetId: string; url: string },
            sessionId: string,
          ) => Promise<void>;
        };

        if (contextAny?.onAttachedToTarget) {
          try {
            await contextAny.onAttachedToTarget(info, sid);

            // Check if Stagehand actually registered it
            await new Promise(resolve => setTimeout(resolve, 100));

            if (isTrackedByStagehand(info.targetId)) {
              this.logger.debug?.('Page registered successfully, setting as active');
              const pages = stagehand.context?.pages() || [];
              const newPage = pages.find(p => p.targetId() === info.targetId);
              if (newPage && stagehand.context) {
                stagehand.context.setActivePage(newPage);
              }
              void this.reconnectScreencastForThread(threadId, 'manual tab tracked');
              void setupPageNavigationListener();
            } else {
              this.logger.debug?.('Stagehand did not register the page (non-injectable URL)');
            }
          } catch (e) {
            this.logger.debug?.('Failed to register page with Stagehand', e);
          }
        }
      }, 300);
    };

    // Listen for tab destruction
    const onTargetDestroyed = (params: { targetId: string }) => {
      this.logger.debug?.('Page target destroyed');

      // Clean up session tracking
      targetSessions.delete(params.targetId);

      // Debounce to avoid rapid reconnects (per-thread timer)
      const existingTimer = this.tabChangeDebounceTimers.get(streamKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      this.tabChangeDebounceTimers.set(
        streamKey,
        setTimeout(() => {
          this.tabChangeDebounceTimers.delete(streamKey);
          void this.reconnectScreencastForThread(threadId, 'tab closed');
          // Re-setup navigation listener for the new active page
          void setupPageNavigationListener();
          // Note: Don't save state here - races with browser shutdown.
          // State is saved via tool handlers instead.
        }, 300),
      );
    };

    // Listen for navigation events (URL changes) on the PAGE-specific CDP session
    const onFrameNavigated = (params: { frame: { url: string; parentId?: string } }) => {
      // Only emit URL for main frame navigations (no parentId)
      if (!params.frame.parentId && params.frame.url) {
        stream.emitUrl(params.frame.url);
        // Update session state on navigation
        this.updateSessionBrowserState(threadId);
      }
    };

    // Track the page session for cleanup
    let pageSession: {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
    } | null = null;

    // Set up page-level navigation listener
    const setupPageNavigationListener = async () => {
      try {
        // Clean up previous page session listener if any
        if (pageSession?.off) {
          pageSession.off('Page.frameNavigated', onFrameNavigated as (...args: unknown[]) => void);
        }

        const page = stagehand.context?.activePage();
        if (!page) return;

        // Get PAGE-specific CDP session (not browser-level connection)
        const session = page.getSessionForFrame(page.mainFrameId());
        if (!session) return;

        pageSession = session as typeof pageSession;
        await session.send('Page.enable');
        session.on('Page.frameNavigated', onFrameNavigated as (...args: unknown[]) => void);

        // Emit the current URL immediately (since framenavigated won't fire for already-loaded pages)
        const currentUrl = page.url();
        if (currentUrl && currentUrl !== 'about:blank') {
          stream.emitUrl(currentUrl);
        }
      } catch (error) {
        this.logger.debug?.('Failed to set up page navigation listener', error);
      }
    };

    // Register cleanup handler first to ensure we can clean up even if setup fails partway
    const cleanup = () => {
      // Clear per-thread debounce timer
      const timer = this.tabChangeDebounceTimers.get(streamKey);
      if (timer) {
        clearTimeout(timer);
        this.tabChangeDebounceTimers.delete(streamKey);
      }
      if (targetInfoDebounceTimer) {
        clearTimeout(targetInfoDebounceTimer);
        targetInfoDebounceTimer = null;
      }
      connection.off?.('Target.targetCreated', onTargetCreated);
      connection.off?.('Target.targetDestroyed', onTargetDestroyed);
      connection.off?.('Target.attachedToTarget', onTargetAttached);
      connection.off?.('Target.targetInfoChanged', onTargetInfoChanged);
      // Clean up page session listener
      if (pageSession?.off) {
        pageSession.off('Page.frameNavigated', onFrameNavigated as (...args: unknown[]) => void);
      }
    };

    // Register cleanup before adding listeners to prevent leaks on partial setup failure
    stream.once('stop', cleanup);

    try {
      connection.on?.('Target.targetCreated', onTargetCreated);
      connection.on?.('Target.targetDestroyed', onTargetDestroyed);
      connection.on?.('Target.attachedToTarget', onTargetAttached);
      connection.on?.('Target.targetInfoChanged', onTargetInfoChanged);

      // Set up navigation listener on the current page
      await setupPageNavigationListener();
    } catch (error) {
      this.logger.debug?.('Failed to set up tab change detection', error);
      // Cleanup is already registered on stream stop, no need to call here
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
    const page = await this.threadManager.getPageForThread(effectiveThreadId);
    const cdpSession = this.getCdpSessionForPage(page);

    if (!cdpSession) {
      throw new Error('No CDP session available');
    }

    // CDP buttons bitmask: left=1, right=2, middle=4
    const buttonMap: Record<string, number> = {
      none: 0,
      left: 1,
      middle: 4,
      right: 2,
    };

    // clickCount should only default to 1 for press/release events; move and wheel use 0
    const defaultClickCount = event.type === 'mousePressed' || event.type === 'mouseReleased' ? 1 : 0;

    await cdpSession.send('Input.dispatchMouseEvent', {
      type: event.type,
      x: event.x,
      y: event.y,
      button: event.button ?? 'none',
      buttons: buttonMap[event.button ?? 'none'] ?? 0,
      clickCount: event.clickCount ?? defaultClickCount,
      deltaX: event.deltaX ?? 0,
      deltaY: event.deltaY ?? 0,
      modifiers: event.modifiers ?? 0,
    });
  }

  override async injectKeyboardEvent(event: KeyboardEventParams, threadId?: string): Promise<void> {
    // Use the provided threadId, or fall back to the current thread
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const page = await this.threadManager.getPageForThread(effectiveThreadId);
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

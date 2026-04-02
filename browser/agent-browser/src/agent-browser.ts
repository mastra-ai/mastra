import { MastraBrowser, ScreencastStreamImpl, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type {
  BrowserState,
  BrowserTabState,
  BrowserToolError,
  ScreencastOptions,
  ScreencastStream,
  CdpSessionProvider,
  CdpSessionLike,
  MouseEventParams,
  KeyboardEventParams,
} from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';

import { BrowserManager } from 'agent-browser';
import type { BrowserLaunchOptions } from 'agent-browser';
import type { Page, Locator } from 'playwright-core';
import type {
  GotoInput,
  SnapshotInput,
  ClickInput,
  TypeInput,
  PressInput,
  SelectInput,
  ScrollInput,
  HoverInput,
  DialogInput,
  WaitInput,
  TabsInput,
  DragInput,
  EvaluateInput,
} from './schemas';
import { AgentBrowserThreadManager } from './thread-manager';
import { createAgentBrowserTools } from './tools';
import type { BrowserConfig } from './types';

/**
 * AgentBrowser - Browser automation using agent-browser (vercel-labs/agent-browser)
 *
 * Uses snapshot + refs pattern for LLM-friendly element targeting.
 */
export class AgentBrowser extends MastraBrowser {
  override readonly id: string;
  override readonly name = 'AgentBrowser';
  override readonly provider = 'vercel-labs/agent-browser';

  /** Primary browser manager (for 'none' mode, also used as fallback) */
  private browserManager: BrowserManager | null = null;
  private defaultTimeout = 30000;

  /** Active screencast stream for triggering reconnects on tab changes */
  private activeScreencastStream: ScreencastStreamImpl | null = null;

  /** Thread manager - narrowed type from base class */
  declare protected threadManager: AgentBrowserThreadManager;

  constructor(config: BrowserConfig = {}) {
    super(config);
    this.id = `agent-browser-${Date.now()}`;
    if (config.timeout) {
      this.defaultTimeout = config.timeout;
    }

    // Initialize thread manager
    // Default to 'browser' isolation so each thread gets its own browser instance
    this.threadManager = new AgentBrowserThreadManager({
      isolation: config.threadIsolation ?? 'browser',
      browserConfig: config,
      resolveCdpUrl: this.resolveCdpUrl.bind(this),
      logger: this.logger,
      // When a new thread session is created, notify listeners so screencast can start
      onSessionCreated: () => {
        // Trigger onBrowserReady callbacks - this allows ViewerRegistry to start screencast
        // for threads that just started using the browser
        this.notifyBrowserReady();
      },
      // When a new browser is created for a thread, set up close listener
      onBrowserCreated: (manager, threadId) => {
        this.setupCloseListenerForThread(manager, threadId);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Thread Isolation (delegated to ThreadManager)
  // ---------------------------------------------------------------------------

  /**
   * Ensure browser is ready and thread session exists.
   * Creates a new page/context for the current thread if needed.
   *
   * For 'browser' isolation, we need to create the thread session BEFORE
   * calling super.ensureReady() because the base class's ensureReady() will
   * call checkBrowserAlive(), which needs at least one thread browser to exist.
   */
  override async ensureReady(): Promise<void> {
    const isolation = this.threadManager.getIsolationMode();
    const threadId = this.getCurrentThread();
    const existingSession = this.threadManager.hasSession(threadId);

    // For 'browser' isolation, create the thread session first
    // This ensures checkBrowserAlive() has a browser to check
    if (isolation === 'browser' && threadId !== DEFAULT_THREAD_ID && !existingSession) {
      await this.getManagerForThread(threadId);
    }

    await super.ensureReady();

    // For 'browser' isolation with existing session, just verify it's accessible
    if (isolation === 'browser' && threadId !== DEFAULT_THREAD_ID && existingSession) {
      await this.getManagerForThread(threadId);
    }
  }

  /**
   * Get the browser manager for the current thread.
   * Delegates to ThreadManager for isolation handling.
   */
  async getManagerForThread(threadId?: string): Promise<BrowserManager> {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const isolation = this.threadManager.getIsolationMode();

    // In 'browser' isolation, if no specific threadId, use the shared manager
    // (which IS launched, unlike in DEFAULT_THREAD_ID case which would return placeholder)
    if (isolation === 'browser' && (!effectiveThreadId || effectiveThreadId === DEFAULT_THREAD_ID)) {
      // Check if we have any active thread sessions
      const existingManager = this.threadManager.getExistingManagerForThread(effectiveThreadId);
      if (existingManager) {
        return existingManager;
      }
      // Fall through to create a session for DEFAULT_THREAD_ID
    }

    return this.threadManager.getManagerForThread(effectiveThreadId);
  }

  /**
   * Get the page for a specific thread.
   * For thread-isolated modes, ensures we're on the correct context/page.
   */
  async getPageForThread(threadId?: string): Promise<Page> {
    const manager = await this.getManagerForThread(threadId);
    return manager.getPage();
  }

  /**
   * Close a specific thread's browser session.
   * Delegates to ThreadManager.
   */
  async closeThreadSession(threadId: string): Promise<void> {
    await this.threadManager.destroySession(threadId);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
    const isolation = this.threadManager.getIsolationMode();

    // For 'browser' isolation, don't launch a shared browser.
    // Each thread will get its own dedicated browser via createSession().
    if (isolation === 'browser') {
      // Create a placeholder manager that's never launched.
      // Thread-specific browsers are created in ThreadManager.createSession().
      this.browserManager = new BrowserManager();
      this.threadManager.setSharedManager(this.browserManager);
      // Don't call notifyBrowserReady() here - that happens in onSessionCreated
      // when the first thread creates its dedicated browser.
      return;
    }

    // For 'none' isolation, launch the shared browser
    this.browserManager = new BrowserManager();

    const localConfig = this.config as BrowserConfig;
    const launchOptions: BrowserLaunchOptions = {
      headless: localConfig.headless ?? true,
    };

    // Resolve CDP URL if provided (can be string or function)
    if (localConfig.cdpUrl) {
      launchOptions.cdpUrl = await this.resolveCdpUrl(localConfig.cdpUrl);
    }

    await this.browserManager.launch(launchOptions);

    // Register the shared manager with ThreadManager
    this.threadManager.setSharedManager(this.browserManager);

    // Set up close listeners to detect external browser closure
    this.setupCloseListenerForNoneIsolation(this.browserManager);
  }

  /**
   * Set up close event listeners for 'none' isolation shared browser.
   * This handles the case where the shared browser is closed externally.
   */
  private setupCloseListenerForNoneIsolation(manager: BrowserManager): void {
    try {
      let disconnectHandled = false;
      const handleDisconnect = () => {
        if (disconnectHandled) return;
        disconnectHandled = true;
        this.handleBrowserDisconnected();
      };

      // Listen for context close (fires when browser window is closed)
      const context = manager.getContext();
      if (context) {
        context.on('close', handleDisconnect);
      }

      // Listen for last page closing (primary detection method)
      const pages = manager.getPages();
      for (const page of pages) {
        page.on('close', () => {
          const remainingPages = manager.getPages();
          if (remainingPages.length === 0) {
            handleDisconnect();
          }
        });
      }
    } catch {
      // Ignore errors setting up close listener
    }
  }

  protected override async doClose(): Promise<void> {
    // Close all thread sessions via ThreadManager
    await this.threadManager.destroyAllSessions();
    this.setCurrentThread(undefined); // Reset to default thread

    // Close the main browser manager (only for 'none' isolation where it's actually launched)
    const isolation = this.threadManager.getIsolationMode();
    if (isolation === 'none' && this.browserManager) {
      await this.browserManager.close();
    }
    this.browserManager = null;
  }

  /**
   * Check if the browser is still alive by verifying the page is connected.
   * Called by base class ensureReady() to detect externally closed browsers.
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    const isolation = this.threadManager.getIsolationMode();

    // For 'browser' isolation, check if any thread browsers are running
    if (isolation === 'browser') {
      return this.threadManager.hasActiveThreadBrowsers();
    }

    // For 'none' isolation, check the shared browser
    if (!this.browserManager) {
      return false;
    }
    try {
      const page = this.browserManager.getPage();
      // Will throw if browser is disconnected
      const url = page.url();
      // Save browser state for potential restore on relaunch
      if (url && url !== 'about:blank') {
        const state = await this.getBrowserState();
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

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  /**
   * Get the browser tools for this provider.
   * Returns 17 flat tools for browser automation.
   */
  getTools(): Record<string, Tool<any, any>> {
    return createAgentBrowserTools(this);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Get the page for the current thread.
   * Uses thread isolation if enabled, otherwise returns the shared page.
   */
  private async getPage(): Promise<Page> {
    const isolation = this.getThreadIsolationMode();
    const threadId = this.getCurrentThread();
    // For browser isolation, always use getPageForThread even for default thread
    // For none isolation with non-default thread, also use getPageForThread
    if (isolation === 'browser' || (isolation !== 'none' && threadId !== DEFAULT_THREAD_ID)) {
      return this.getPageForThread(threadId);
    }
    if (!this.browserManager) throw new Error('Browser not launched');
    return this.browserManager.getPage();
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
      this.logger.debug?.(`Cleared browser session for thread: ${threadId}`);
    } else {
      // For 'none' isolation or default thread, the shared browser is gone
      this.browserManager = null;
      // Also clear the shared manager in the thread manager so getManagerForThread
      // doesn't return the dead manager
      this.threadManager.clearSharedManager();
    }

    super.handleBrowserDisconnected();
  }

  /**
   * Set up close event listener for a thread's browser manager.
   * This handles the case where a thread's browser is closed externally.
   */
  private setupCloseListenerForThread(manager: BrowserManager, threadId: string): void {
    try {
      let disconnectHandled = false;
      const handleDisconnect = () => {
        if (disconnectHandled) return;
        disconnectHandled = true;
        this.handleThreadBrowserDisconnected(threadId);
      };

      // Listen for context close (fires when browser window is closed)
      const context = manager.getContext();
      if (context) {
        context.on('close', handleDisconnect);
      }

      // Listen for last page closing (primary detection method)
      const pages = manager.getPages();
      for (const page of pages) {
        page.on('close', () => {
          const remainingPages = manager.getPages();
          if (remainingPages.length === 0) {
            handleDisconnect();
          }
        });
      }
    } catch {
      // Ignore errors setting up close listener
    }
  }

  /**
   * Handle browser disconnection for a specific thread.
   * Called when a thread's browser is closed externally.
   */
  private handleThreadBrowserDisconnected(threadId: string): void {
    this.threadManager.clearSession(threadId);
    this.logger.debug?.(`Cleared browser session for thread: ${threadId}`);
    // Notify base class - this will trigger notifyBrowserClosed()
    super.handleBrowserDisconnected();
  }

  /**
   * Create an error response from an exception.
   * Extends base class to add agent-browser specific error handling.
   */
  protected override createErrorFromException(error: unknown, context: string): BrowserToolError {
    const msg = error instanceof Error ? error.message : String(error);

    // Check for stale refs (agent-browser specific)
    if (msg.includes('stale') || msg.includes('Stale')) {
      return this.createError(
        'stale_ref',
        'Element ref is no longer valid.',
        'Get a fresh snapshot and use updated refs.',
      );
    }

    // Check for element not found (agent-browser specific)
    if (msg.includes('not found') || msg.includes('No element')) {
      return this.createError(
        'element_not_found',
        'Element not found.',
        'Check the ref is correct or get a fresh snapshot.',
      );
    }

    // Delegate to base class for common errors
    return super.createErrorFromException(error, context);
  }

  private async requireLocator(ref: string): Promise<Locator | null> {
    const manager = await this.getManagerForThread();
    // Use the built-in getLocatorFromRef method which properly converts refs to locators
    return manager.getLocatorFromRef(ref);
  }

  private async getScrollInfo(): Promise<{
    scrollY: number;
    scrollHeight: number;
    viewportHeight: number;
    atTop: boolean;
    atBottom: boolean;
    percentDown: number;
  }> {
    const page = await this.getPage();
    const info = (await page.evaluate(`({
      scrollY: Math.round(window.scrollY),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight
    })`)) as { scrollY: number; scrollHeight: number; viewportHeight: number } | undefined;

    // Handle cases where evaluate returns undefined (e.g., in tests)
    if (!info || typeof info.scrollHeight !== 'number') {
      return {
        scrollY: 0,
        scrollHeight: 0,
        viewportHeight: 0,
        atTop: true,
        atBottom: true,
        percentDown: 0,
      };
    }

    const maxScroll = info.scrollHeight - info.viewportHeight;
    return {
      ...info,
      atTop: info.scrollY < 50,
      atBottom: info.scrollY >= maxScroll - 50,
      percentDown: maxScroll > 0 ? Math.round((info.scrollY / maxScroll) * 100) : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // URL Access
  // ---------------------------------------------------------------------------

  /**
   * Get the current page URL without launching the browser.
   * @param threadId - Optional thread ID for thread-isolated browsers
   * @returns The current URL string, or null if browser is not running
   */
  override async getCurrentUrl(threadId?: string): Promise<string | null> {
    if (!this.isBrowserRunning()) {
      return null;
    }
    try {
      const effectiveThreadId = threadId ?? this.getCurrentThread();
      const isolation = this.threadManager.getIsolationMode();

      // For 'browser' isolation, check if we have an existing session first
      // Don't create a new session just to get the URL
      if (isolation === 'browser' && effectiveThreadId) {
        const manager = this.threadManager.getExistingManagerForThread(effectiveThreadId);
        if (!manager) {
          return null; // No session yet, don't create one
        }
        const url = manager.getPage().url();
        // Save browser state for potential restore on relaunch (before external close)
        if (url && url !== 'about:blank') {
          const state = this.getBrowserStateForManager(manager);
          if (state) {
            this.threadManager.updateBrowserState(effectiveThreadId, state);
          }
        }
        return url;
      }

      // For 'none' isolation, use the shared manager
      const manager = await this.getManagerForThread(threadId);
      const url = manager.getPage().url();
      // Save browser state for potential restore on relaunch (before external close)
      if (url && url !== 'about:blank') {
        const state = this.getBrowserStateForManager(manager);
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
   * Navigate to a URL (simple form). Used internally for restoring state on relaunch.
   */
  override async navigateTo(url: string): Promise<void> {
    if (!this.isBrowserRunning()) {
      return;
    }
    try {
      const page = await this.getPage();
      await page.goto(url, {
        timeout: this.defaultTimeout,
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
      const manager = await this.getManagerForThread(threadId);
      return this.getBrowserStateForManager(manager);
    } catch {
      return null;
    }
  }

  /**
   * Get browser state from a specific manager instance.
   */
  private getBrowserStateForManager(manager: BrowserManager): BrowserState | null {
    try {
      const pages = manager.getPages();
      const activeIndex = manager.getActiveIndex();

      const tabs: BrowserTabState[] = pages.map(page => ({
        url: page.url(),
      }));

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
    if (!this.isBrowserRunning()) {
      return 0;
    }
    try {
      const manager = await this.getManagerForThread(threadId);
      return manager.getActiveIndex();
    } catch {
      return 0;
    }
  }

  /**
   * Update the browser state in the thread session.
   * Called on navigation, tab open/close to keep state fresh.
   */
  private updateSessionBrowserState(threadId?: string): void {
    try {
      const effectiveThreadId = threadId ?? this.getCurrentThread() ?? DEFAULT_THREAD_ID;
      const isolation = this.threadManager.getIsolationMode();

      let manager: BrowserManager | null = null;
      if (isolation === 'browser') {
        manager = this.threadManager.getExistingManagerForThread(effectiveThreadId);
      } else {
        manager = this.browserManager;
      }

      if (manager) {
        const state = this.getBrowserStateForManager(manager);
        if (state) {
          this.threadManager.updateBrowserState(effectiveThreadId, state);
        }
      }
    } catch {
      // Silently ignore errors during state update
    }
  }

  // ---------------------------------------------------------------------------
  // 1. browser_goto - Navigate to URL
  // ---------------------------------------------------------------------------

  async goto(
    input: GotoInput,
  ): Promise<{ success: true; url: string; title: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();

      await page.goto(input.url, {
        timeout: input.timeout ?? this.defaultTimeout,
        waitUntil: input.waitUntil ?? 'domcontentloaded',
      });

      return {
        success: true,
        url: page.url(),
        title: await page.title(),
        hint: 'Take a snapshot to see interactive elements and get refs.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Goto');
    }
  }

  // ---------------------------------------------------------------------------
  // 2. browser_snapshot - Capture accessibility tree
  // ---------------------------------------------------------------------------

  async snapshot(input: SnapshotInput): Promise<
    | {
        success: true;
        snapshot: string;
        url: string;
        title: string;
        elementCount: number;
        scroll: string;
        hint?: string;
      }
    | BrowserToolError
  > {
    try {
      const manager = await this.getManagerForThread();
      const page = await this.getPage();
      const rawSnapshot = await manager.getSnapshot({
        interactive: input.interactiveOnly ?? true,
        compact: true,
      });

      // Transform tree refs from [ref=e1] format to @e1 format for consistency
      const snapshot = (rawSnapshot.tree ?? '').replace(/\[ref=(\w+)\]/g, '@$1');

      // Get scroll position info
      const scrollInfo = await this.getScrollInfo();
      let scrollText: string;
      if (scrollInfo.atTop && !scrollInfo.atBottom) {
        scrollText = 'TOP - more content below';
      } else if (scrollInfo.atBottom) {
        scrollText = 'BOTTOM of page';
      } else {
        scrollText = `${scrollInfo.percentDown}% down`;
      }

      // Count refs
      const refs = snapshot.match(/@e\d+/g) || [];
      const elementCount = new Set(refs).size;

      return {
        success: true,
        snapshot,
        url: page.url(),
        title: await page.title(),
        elementCount,
        scroll: scrollText,
        hint:
          elementCount === 0
            ? 'No interactive elements found. Try scrolling or setting interactiveOnly:false.'
            : undefined,
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Snapshot');
    }
  }

  // ---------------------------------------------------------------------------
  // 3. browser_click - Click on element
  // ---------------------------------------------------------------------------

  async click(input: ClickInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = await this.requireLocator(input.ref);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page has changed.`,
          'Take a new snapshot to see the current page state and get fresh refs.',
        );
      }

      await locator.click({
        button: input.button ?? 'left',
        clickCount: input.clickCount ?? 1,
        modifiers: input.modifiers,
        timeout: this.defaultTimeout,
      });

      return {
        success: true,
        url: page.url(),
        hint: 'Take a new snapshot to see updated page state and get fresh refs.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('intercepts pointer events')) {
        return this.createError(
          'element_blocked',
          `Element ${input.ref} is blocked by another element.`,
          'Take a new snapshot to see what is blocking. Dismiss any modals or scroll the element into view.',
        );
      }

      return this.createErrorFromException(error, 'Click');
    }
  }

  // ---------------------------------------------------------------------------
  // 4. browser_type - Type text into element
  // ---------------------------------------------------------------------------

  async type(
    input: TypeInput,
  ): Promise<{ success: true; value: string; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = await this.requireLocator(input.ref);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page has changed.`,
          'Take a new snapshot to see the current page state and get fresh refs.',
        );
      }

      if (input.clear) {
        await locator.fill('', { timeout: this.defaultTimeout });
      }

      if (input.delay) {
        await locator.focus();
        for (const char of input.text) {
          await page.keyboard.press(char);
          await new Promise(r => setTimeout(r, input.delay));
        }
      } else {
        await locator.fill(input.text, { timeout: this.defaultTimeout });
      }

      // Get the actual value in the field
      const value = await locator.inputValue({ timeout: 1000 }).catch(() => input.text);

      return {
        success: true,
        value,
        url: page.url(),
        hint: 'Take a new snapshot if you need to interact with more elements.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (
        errorMsg.includes('is not an <input>') ||
        errorMsg.includes('not an input') ||
        errorMsg.includes('Cannot type') ||
        errorMsg.includes('not focusable')
      ) {
        return this.createError(
          'not_focusable',
          `Element ${input.ref} is not a text input field.`,
          'Take a new snapshot and look for elements with role "textbox" or "searchbox".',
        );
      }

      return this.createErrorFromException(error, 'Type');
    }
  }

  // ---------------------------------------------------------------------------
  // 5. browser_press - Press keyboard key(s)
  // ---------------------------------------------------------------------------

  async press(input: PressInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      await page.keyboard.press(input.key);

      return {
        success: true,
        url: page.url(),
        hint: 'Take a new snapshot if the page may have changed.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Press');
    }
  }

  // ---------------------------------------------------------------------------
  // 6. browser_select - Select dropdown option
  // ---------------------------------------------------------------------------

  async select(
    input: SelectInput,
  ): Promise<{ success: true; selected: string[]; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = await this.requireLocator(input.ref);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page has changed.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      const selectValue: { value?: string; label?: string; index?: number } = {};
      if (input.value) selectValue.value = input.value;
      if (input.label) selectValue.label = input.label;
      if (input.index !== undefined) selectValue.index = input.index;

      const selected = await locator.selectOption(selectValue, {
        timeout: this.defaultTimeout,
      });

      return {
        success: true,
        selected,
        url: page.url(),
        hint: 'Selection complete. Take a snapshot if you need to continue.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Select');
    }
  }

  // ---------------------------------------------------------------------------
  // 7. browser_scroll - Scroll page or element
  // ---------------------------------------------------------------------------

  async scroll(
    input: ScrollInput,
  ): Promise<{ success: true; position: { x: number; y: number }; scroll: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();

      if (input.ref) {
        const locator = await this.requireLocator(input.ref);
        if (locator) {
          await locator.scrollIntoViewIfNeeded({ timeout: this.defaultTimeout });
        }
      } else {
        const direction = input.direction;
        const amount = input.amount ?? 300;

        let deltaX = 0;
        let deltaY = 0;

        switch (direction) {
          case 'up':
            deltaY = -amount;
            break;
          case 'down':
            deltaY = amount;
            break;
          case 'left':
            deltaX = -amount;
            break;
          case 'right':
            deltaX = amount;
            break;
        }

        await page.evaluate(
          ({ x, y }: { x: number; y: number }) => {
            (globalThis as any).scrollBy(x, y);
          },
          { x: deltaX, y: deltaY },
        );
      }

      // Get new scroll position
      const scrollInfo = await this.getScrollInfo();
      let scrollText: string;
      if (scrollInfo.atTop && !scrollInfo.atBottom) {
        scrollText = 'TOP - more content below';
      } else if (scrollInfo.atBottom) {
        scrollText = 'BOTTOM of page';
      } else {
        scrollText = `${scrollInfo.percentDown}% down`;
      }

      return {
        success: true,
        position: { x: 0, y: scrollInfo.scrollY },
        scroll: scrollText,
        hint: 'Take a new snapshot to see elements in the new viewport.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Scroll');
    }
  }

  // ---------------------------------------------------------------------------
  // 8. browser_hover - Hover over element
  // ---------------------------------------------------------------------------

  async hover(input: HoverInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = await this.requireLocator(input.ref);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page has changed.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      await locator.hover({ timeout: this.defaultTimeout });

      return {
        success: true,
        url: page.url(),
        hint: 'Take a new snapshot to see any hover-triggered elements (dropdowns, tooltips).',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Hover');
    }
  }

  // ---------------------------------------------------------------------------
  // 10. browser_back - Navigate back
  // ---------------------------------------------------------------------------

  async back(): Promise<{ success: true; url: string; title: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      await page.goBack({ timeout: this.defaultTimeout });

      return {
        success: true,
        url: page.url(),
        title: await page.title(),
        hint: 'Take a new snapshot to see the previous page.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Back');
    }
  }

  // ---------------------------------------------------------------------------
  // 11. browser_dialog - Click element that triggers dialog and handle it
  // ---------------------------------------------------------------------------

  async dialog(
    input: DialogInput,
  ): Promise<
    | { success: true; action: 'accept' | 'dismiss'; dialogType: string; message: string; hint: string }
    | BrowserToolError
  > {
    try {
      const page = await this.getPage();
      const locator = await this.requireLocator(input.triggerRef);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Trigger ref ${input.triggerRef} not found.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          page.off('dialog', dialogHandler);
          reject(
            new Error(`No dialog appeared after clicking ${input.triggerRef}. The element may not trigger a dialog.`),
          );
        }, this.defaultTimeout);

        const dialogHandler = async (dialog: any) => {
          clearTimeout(timeout);
          try {
            const dialogType = dialog.type();
            const message = dialog.message();

            if (input.action === 'accept') {
              await dialog.accept(input.text);
            } else {
              await dialog.dismiss();
            }
            resolve({
              success: true,
              action: input.action,
              dialogType,
              message,
              hint: 'Dialog handled. Take a snapshot to continue.',
            });
          } catch (e) {
            reject(e);
          }
        };

        // Set up listener first, then click
        page.once('dialog', dialogHandler);

        // Click the trigger element (don't await - dialog blocks execution)
        locator.click({ timeout: this.defaultTimeout }).catch((e: Error) => {
          clearTimeout(timeout);
          page.off('dialog', dialogHandler);
          reject(e);
        });
      });
    } catch (error) {
      return this.createErrorFromException(error, 'Dialog');
    }
  }

  // ---------------------------------------------------------------------------
  // 13. browser_wait - Wait for element or condition
  // ---------------------------------------------------------------------------

  async wait(input: WaitInput): Promise<{ success: true; hint: string } | BrowserToolError> {
    try {
      const timeout = input.timeout ?? this.defaultTimeout;

      if (input.ref) {
        const locator = await this.requireLocator(input.ref);
        if (!locator) {
          return this.createError('stale_ref', `Ref ${input.ref} not found.`, 'Take a new snapshot to get fresh refs.');
        }

        const state = input.state ?? 'visible';
        await locator.waitFor({ state, timeout });

        return {
          success: true,
          hint: `Element is now ${state}. Take a snapshot to continue.`,
        };
      } else {
        const page = await this.getPage();
        await page.waitForTimeout(timeout);
        return {
          success: true,
          hint: 'Wait complete. Take a snapshot to see current state.',
        };
      }
    } catch (error) {
      return this.createErrorFromException(error, 'Wait');
    }
  }

  // ---------------------------------------------------------------------------
  // 14. browser_tabs - Manage browser tabs
  // ---------------------------------------------------------------------------

  async tabs(input: TabsInput): Promise<
    | {
        success: true;
        tabs?: unknown[];
        index?: number;
        url?: string;
        title?: string;
        remaining?: number;
        hint: string;
      }
    | BrowserToolError
  > {
    try {
      const browser = await this.getManagerForThread();
      if (!browser) {
        return this.createError(
          'browser_closed',
          'Browser not launched',
          'Call a navigation tool first to launch the browser.',
        );
      }

      switch (input.action) {
        case 'list': {
          if (!browser.listTabs) {
            return this.createError(
              'browser_error',
              'Tab management not supported',
              'This browser provider does not support tab management.',
            );
          }
          const tabsList = await browser.listTabs();
          return {
            success: true,
            tabs: tabsList,
            hint: 'Use browser_tabs with action:"switch" and index to change tabs.',
          };
        }

        case 'new': {
          if (!browser.newTab) {
            return this.createError(
              'browser_error',
              'Tab management not supported',
              'This browser provider does not support tab management.',
            );
          }
          const result = await browser.newTab();
          // If URL provided, navigate to it after creating the tab
          if (input.url) {
            const page = await this.getPage();
            await page.goto(input.url);
          }
          // Save state after new tab
          this.updateSessionBrowserState();
          return {
            success: true,
            ...result,
            hint: 'New tab opened. Take a snapshot to see its content.',
          };
        }

        case 'switch': {
          if (!browser.switchTo) {
            return this.createError(
              'browser_error',
              'Tab management not supported',
              'This browser provider does not support tab management.',
            );
          }
          await browser.switchTo(input.index!);
          // Reconnect screencast to show the new active tab
          await this.reconnectScreencast('tab switch');
          const page = browser.getPage();
          const pageUrl = page.url();
          // Emit URL directly after switch
          if (pageUrl && this.activeScreencastStream?.isActive()) {
            this.activeScreencastStream.emitUrl(pageUrl);
          }
          // Save state after switch (captures activeIndex change)
          this.updateSessionBrowserState();
          return {
            success: true,
            index: input.index,
            url: pageUrl,
            title: await page.title(),
            hint: 'Tab switched. Take a snapshot to see its content.',
          };
        }

        case 'close': {
          if (!browser.closeTab) {
            return this.createError(
              'browser_error',
              'Tab management not supported',
              'This browser provider does not support tab management.',
            );
          }
          await browser.closeTab(input.index);
          // Reconnect screencast - it may now be pointing to a different tab
          await this.reconnectScreencast('tab close');
          // Save state AFTER close (remaining tabs)
          this.updateSessionBrowserState();
          const tabsList = (await browser.listTabs?.()) ?? [];
          return {
            success: true,
            remaining: tabsList.length,
            hint: tabsList.length > 0 ? 'Tab closed. Take a snapshot to see current tab.' : 'All tabs closed.',
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
  // 15. browser_drag - Drag element to target
  // ---------------------------------------------------------------------------

  async drag(input: DragInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();

      // Resolve source locator (prefer ref, fallback to selector)
      let sourceLocator: Awaited<ReturnType<typeof this.requireLocator>> | null = null;
      if (input.sourceRef) {
        sourceLocator = await this.requireLocator(input.sourceRef);
      } else if (input.sourceSelector) {
        sourceLocator = page.locator(input.sourceSelector);
      }

      if (!sourceLocator) {
        return this.createError(
          'stale_ref',
          input.sourceRef
            ? `Source ref ${input.sourceRef} not found.`
            : 'No source element specified. Provide sourceRef or sourceSelector.',
          input.sourceRef
            ? 'Take a new snapshot to get fresh refs, or use sourceSelector for elements not in the accessibility tree.'
            : undefined,
        );
      }

      // Resolve target locator (prefer ref, fallback to selector)
      let targetLocator: Awaited<ReturnType<typeof this.requireLocator>> | null = null;
      if (input.targetRef) {
        targetLocator = await this.requireLocator(input.targetRef);
      } else if (input.targetSelector) {
        targetLocator = page.locator(input.targetSelector);
      }

      if (!targetLocator) {
        return this.createError(
          'stale_ref',
          input.targetRef
            ? `Target ref ${input.targetRef} not found.`
            : 'No target element specified. Provide targetRef or targetSelector.',
          input.targetRef
            ? 'Take a new snapshot to get fresh refs, or use targetSelector for elements not in the accessibility tree.'
            : undefined,
        );
      }

      await sourceLocator.dragTo(targetLocator, { timeout: this.defaultTimeout });

      return {
        success: true,
        url: page.url(),
        hint: 'Drag complete. Take a snapshot to see the result.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Drag');
    }
  }

  // ---------------------------------------------------------------------------
  // 16. browser_evaluate - Execute JavaScript
  // ---------------------------------------------------------------------------

  async evaluate(input: EvaluateInput): Promise<{ success: true; result: unknown; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      // Wrap script in an async function to allow return statements
      const wrappedScript = `(async () => { ${input.script} })()`;
      const result = await page.evaluate(wrappedScript);

      return {
        success: true,
        result,
        hint: 'JavaScript executed. Take a snapshot if the page may have changed.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Evaluate');
    }
  }

  // ---------------------------------------------------------------------------
  // 17. browser_close - Close browser
  // ---------------------------------------------------------------------------

  async closeBrowser(): Promise<{ success: true; hint: string } | BrowserToolError> {
    try {
      await this.close();
      return {
        success: true,
        hint: 'Browser closed. Call browser_goto to start a new session.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Close');
    }
  }

  // ---------------------------------------------------------------------------
  // Screencast (for Studio live view)
  // ---------------------------------------------------------------------------

  /**
   * Trigger a screencast reconnect after tab changes.
   * Called internally when tabs are switched or closed.
   */
  private async reconnectScreencast(_reason: string): Promise<void> {
    if (this.activeScreencastStream?.isActive()) {
      // Small delay to let agent-browser update its internal state (activePageIndex, CDP session)
      await new Promise(resolve => setTimeout(resolve, 150));
      if (this.activeScreencastStream?.isActive()) {
        try {
          await this.activeScreencastStream.reconnect();

          // Emit the URL of the new active page after reconnecting
          // Use thread-specific manager in browser isolation mode
          const threadId = this.getCurrentThread();
          const manager = this.threadManager.getExistingManagerForThread(threadId) ?? this.browserManager;
          const activePage = manager?.getPage();
          if (activePage) {
            const url = activePage.url();
            if (url) {
              this.activeScreencastStream.emitUrl(url);
            }
          }
        } catch (err) {
          console.error('[AgentBrowser] Failed to reconnect screencast:', err);
        }
      }
    }
  }

  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    if (!this.browserManager) throw new Error('Browser not launched');

    const threadId = _options?.threadId;

    // For 'browser' isolation, each thread has its own BrowserManager
    // For 'none', we use the shared manager
    const browserManager = threadId ? await this.getManagerForThread(threadId) : this.browserManager;

    // Create CDP session provider adapter
    // The provider always gets a fresh CDP session for the current active page
    const provider: CdpSessionProvider = {
      getCdpSession: async () => {
        // Always get the current active page and create a fresh CDP session for it
        const currentPage = browserManager.getPage();
        if (!currentPage) {
          throw new Error('No active page available');
        }
        const cdpSession = await currentPage.context().newCDPSession(currentPage);
        return cdpSession as unknown as CdpSessionLike;
      },
      isBrowserRunning: () => browserManager.isLaunched(),
    };

    const stream = new ScreencastStreamImpl(provider, _options);

    // Store reference so tabs() can trigger reconnects
    this.activeScreencastStream = stream;

    // Set up tab change listener to reconnect screencast when a new tab opens
    const context = browserManager.getContext();
    if (context) {
      const onNewPage = (_newPage: Page) => {
        // Small delay to let agent-browser update its activePageIndex
        setTimeout(() => {
          if (stream.isActive()) {
            stream.reconnect().catch(() => {});
          }
        }, 100);
      };

      context.on('page', onNewPage);

      // Track page close handlers so we can clean them up
      const pageCloseHandlers = new Map<Page, () => void>();

      // Track framenavigated handlers for URL updates
      const frameNavigatedHandlers = new Map<
        Page,
        (frame: { url: () => string; parentFrame: () => unknown }) => void
      >();

      // Add close listener and framenavigated listener to all existing pages
      const setupPageListeners = (page: Page) => {
        // Navigation listener for URL updates
        const onFrameNavigated = (frame: { url: () => string; parentFrame: () => unknown }) => {
          // Only emit URL for main frame navigations
          if (!frame.parentFrame()) {
            stream.emitUrl(frame.url());
            // Update session state on navigation
            this.updateSessionBrowserState(threadId);
          }
        };
        page.on('framenavigated', onFrameNavigated);
        frameNavigatedHandlers.set(page, onFrameNavigated);

        // Close listener
        const onClose = () => {
          pageCloseHandlers.delete(page);
          // Clean up framenavigated handler
          const navHandler = frameNavigatedHandlers.get(page);
          if (navHandler) {
            page.off('framenavigated', navHandler);
            frameNavigatedHandlers.delete(page);
          }
          // Small delay to let agent-browser update its internal state
          setTimeout(() => {
            const remainingPages = browserManager.getPages();
            if (stream.isActive() && remainingPages.length > 0) {
              stream.reconnect().catch(() => {});
              // Emit the URL of the new active page
              const activePage = remainingPages[browserManager.getActiveIndex()] || remainingPages[0];
              if (activePage) {
                const url = activePage.url();
                if (url && url !== 'about:blank') {
                  stream.emitUrl(url);
                }
              }
              // Note: Don't save state here - races with browser shutdown.
              // State is saved via tool handlers instead.
            }
          }, 100);
        };
        page.once('close', onClose);
        pageCloseHandlers.set(page, onClose);
      };

      // Alias for backwards compatibility in the code below
      const setupPageCloseListener = setupPageListeners;

      // Set up listeners for existing pages
      for (const page of browserManager.getPages()) {
        setupPageCloseListener(page);
      }

      // Also set up listener for new pages
      const onNewPageWithCloseListener = (newPage: Page) => {
        setupPageCloseListener(newPage);
        // Emit the new page's current URL immediately (since framenavigated won't fire for the initial load)
        const url = newPage.url();
        if (url && url !== 'about:blank') {
          stream.emitUrl(url);
        }
        // Note: State is saved via tool handlers (new/switch/close), not events
        onNewPage(newPage);
      };

      context.off('page', onNewPage); // Remove the one we added above
      context.on('page', onNewPageWithCloseListener);

      // Clean up listeners when stream stops
      stream.once('stop', () => {
        context.off('page', onNewPageWithCloseListener);
        // Remove close handlers from all pages
        for (const [page, handler] of pageCloseHandlers) {
          page.off('close', handler);
        }
        pageCloseHandlers.clear();
        // Remove framenavigated handlers from all pages
        for (const [page, handler] of frameNavigatedHandlers) {
          page.off('framenavigated', handler);
        }
        frameNavigatedHandlers.clear();
        this.activeScreencastStream = null;
      });
    }

    await stream.start();
    return stream as unknown as ScreencastStream;
  }

  // ---------------------------------------------------------------------------
  // Event Injection (for Studio live view interactivity)
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(event: MouseEventParams, threadId?: string): Promise<void> {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const manager = await this.getManagerForThread(effectiveThreadId);
    await manager.injectMouseEvent(event);
  }

  override async injectKeyboardEvent(event: KeyboardEventParams, threadId?: string): Promise<void> {
    // Get the appropriate manager based on isolation mode
    // Use passed threadId (from input handler) or fall back to current thread
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const manager = await this.getManagerForThread(effectiveThreadId);

    // Use CDP directly to include windowsVirtualKeyCode
    // The agent-browser package's injectKeyboardEvent doesn't pass this field,
    // which breaks non-printable keys like Enter, Backspace, and arrows
    const cdp = await manager.getCDPSession();
    await cdp.send('Input.dispatchKeyEvent', {
      type: event.type,
      key: event.key,
      code: event.code,
      text: event.text,
      modifiers: event.modifiers ?? 0,
      windowsVirtualKeyCode: event.windowsVirtualKeyCode,
    });
  }
}

export default AgentBrowser;

import { MastraBrowser, ScreencastStreamImpl, DEFAULT_THREAD_ID } from '@mastra/core/browser';
import type {
  BrowserToolError,
  ScreencastOptions,
  ScreencastStream,
  ThreadIsolationMode,
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
  ScreenshotInput,
  HoverInput,
  UploadInput,
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

  /** Primary browser manager (for 'none' and 'context' modes) */
  private browserManager: BrowserManager | null = null;
  private defaultTimeout = 30000;

  /** Thread manager for handling thread-scoped browser sessions */
  private threadManager: AgentBrowserThreadManager;

  /** Currently active thread (set by tools before operations) */
  private currentThreadId: string = DEFAULT_THREAD_ID;

  constructor(config: BrowserConfig = {}) {
    super(config);
    this.id = `agent-browser-${Date.now()}`;
    if (config.timeout) {
      this.defaultTimeout = config.timeout;
    }

    // Initialize thread manager
    this.threadManager = new AgentBrowserThreadManager({
      isolation: config.threadIsolation ?? 'none',
      browserConfig: config,
      resolveCdpUrl: this.resolveCdpUrl.bind(this),
      logger: this.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Thread Isolation (delegated to ThreadManager)
  // ---------------------------------------------------------------------------

  /**
   * Set the current thread ID for subsequent operations.
   * Called by tools before executing browser actions.
   */
  setCurrentThread(threadId?: string): void {
    this.currentThreadId = threadId ?? DEFAULT_THREAD_ID;
  }

  /**
   * Get the browser manager for the current thread.
   * Delegates to ThreadManager for isolation handling.
   */
  async getManagerForThread(threadId?: string): Promise<BrowserManager> {
    return this.threadManager.getManagerForThread(threadId ?? this.currentThreadId);
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

  /**
   * Get the current thread isolation mode.
   */
  getThreadIsolationMode(): ThreadIsolationMode {
    return this.threadManager.getIsolationMode();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
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

    // Listen for browser context close events to detect external closure
    // Cast to access Playwright's BrowserContext.on() which the underlying library wraps
    try {
      const page = this.browserManager.getPage();
      const context = page.context() as unknown as { on?: (event: string, cb: () => void) => void };
      if (context?.on) {
        context.on('close', () => {
          this.logger.debug?.('Browser context closed event received');
          this.handleBrowserDisconnected();
        });
      }
    } catch {
      // Ignore errors getting page/context during launch
    }
  }

  protected override async doClose(): Promise<void> {
    // Close all thread sessions via ThreadManager
    await this.threadManager.destroyAllSessions();
    this.currentThreadId = DEFAULT_THREAD_ID;

    // Close the main browser manager
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
  }

  /**
   * Check if the browser is still alive by verifying the page is connected.
   * Called by base class ensureReady() to detect externally closed browsers.
   */
  protected async checkBrowserAlive(): Promise<boolean> {
    if (!this.browserManager) {
      return false;
    }
    try {
      const page = this.browserManager.getPage();
      // Will throw if browser is disconnected
      const url = page.url();
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
   * Get the current thread ID.
   */
  getCurrentThread(): string {
    return this.currentThreadId;
  }

  /**
   * Get the page for the current thread.
   * Uses thread isolation if enabled, otherwise returns the shared page.
   */
  private async getPage(): Promise<Page> {
    const isolation = this.threadManager.getIsolationMode();
    if (isolation !== 'none' && this.currentThreadId !== DEFAULT_THREAD_ID) {
      return this.getPageForThread(this.currentThreadId);
    }
    if (!this.browserManager) throw new Error('Browser not launched');
    return this.browserManager.getPage();
  }

  /**
   * Handle browser disconnection by clearing internal state and calling base class.
   */
  override handleBrowserDisconnected(): void {
    this.browserManager = null;
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

  private requireLocator(ref: string): Locator | null {
    if (!this.browserManager) {
      throw new Error('Browser not launched');
    }
    // Use the built-in getLocatorFromRef method which properly converts refs to locators
    return this.browserManager.getLocatorFromRef(ref);
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
   * @returns The current URL string, or null if browser is not running
   */
  override getCurrentUrl(): string | null {
    if (!this.isBrowserRunning() || !this.browserManager) {
      return null;
    }
    try {
      return this.browserManager.getPage().url();
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
      if (!this.browserManager) throw new Error('Browser not launched');

      const page = await this.getPage();
      const rawSnapshot = await this.browserManager.getSnapshot({
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
      const locator = this.requireLocator(input.ref);

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
      const locator = this.requireLocator(input.ref);

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
      const locator = this.requireLocator(input.ref);

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
        const locator = this.requireLocator(input.ref);
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
  // 8. browser_screenshot - Take screenshot
  // ---------------------------------------------------------------------------

  async screenshot(input: ScreenshotInput): Promise<{ success: true; base64: string } | BrowserToolError> {
    try {
      const page = await this.getPage();

      const options: { fullPage?: boolean; type?: 'png' | 'jpeg' } = {
        fullPage: input.fullPage ?? false,
      };

      let buffer: Buffer;
      if (input.ref) {
        const locator = this.requireLocator(input.ref);
        if (!locator) {
          return this.createError('stale_ref', `Ref ${input.ref} not found.`, 'Take a new snapshot to get fresh refs.');
        }
        buffer = await locator.screenshot(options);
      } else {
        buffer = await page.screenshot(options);
      }

      return { success: true, base64: buffer.toString('base64') };
    } catch (error) {
      return this.createErrorFromException(error, 'Screenshot');
    }
  }

  // ---------------------------------------------------------------------------
  // 9. browser_hover - Hover over element
  // ---------------------------------------------------------------------------

  async hover(input: HoverInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = this.requireLocator(input.ref);

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
  // 11. browser_upload - Upload file(s)
  // ---------------------------------------------------------------------------

  async upload(input: UploadInput): Promise<{ success: true; url: string; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();
      const locator = this.requireLocator(input.ref);

      if (!locator) {
        return this.createError(
          'stale_ref',
          `Ref ${input.ref} not found. The page has changed.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      await locator.setInputFiles(input.files, { timeout: this.defaultTimeout });

      return {
        success: true,
        url: page.url(),
        hint: 'File(s) uploaded. Take a snapshot to see updated state.',
      };
    } catch (error) {
      return this.createErrorFromException(error, 'Upload');
    }
  }

  // ---------------------------------------------------------------------------
  // 12. browser_dialog - Handle dialogs (alert/confirm/prompt)
  // ---------------------------------------------------------------------------

  async dialog(
    input: DialogInput,
  ): Promise<{ success: true; action: 'accept' | 'dismiss'; hint: string } | BrowserToolError> {
    try {
      const page = await this.getPage();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Dialog handler timed out. Make sure the dialog is triggered before calling this.'));
        }, this.defaultTimeout);

        (page as any).once('dialog', async (dialog: any) => {
          clearTimeout(timeout);
          try {
            if (input.action === 'accept') {
              await dialog.accept(input.text);
            } else {
              await dialog.dismiss();
            }
            resolve({
              success: true,
              action: input.action,
              hint: 'Dialog handled. Take a snapshot to continue.',
            });
          } catch (e) {
            reject(e);
          }
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
        const locator = this.requireLocator(input.ref);
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
      const browser = this.browserManager;
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
          const page = browser.getPage();
          return {
            success: true,
            index: input.index,
            url: page.url(),
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
      const sourceLocator = this.requireLocator(input.sourceRef);
      const targetLocator = this.requireLocator(input.targetRef);

      if (!sourceLocator) {
        return this.createError(
          'stale_ref',
          `Source ref ${input.sourceRef} not found.`,
          'Take a new snapshot to get fresh refs.',
        );
      }

      if (!targetLocator) {
        return this.createError(
          'stale_ref',
          `Target ref ${input.targetRef} not found.`,
          'Take a new snapshot to get fresh refs.',
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

  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    if (!this.browserManager) throw new Error('Browser not launched');

    // Create CDP session provider adapter for BrowserManager
    const browserManager = this.browserManager;
    const provider: CdpSessionProvider = {
      getCdpSession: async () => browserManager.getCDPSession() as unknown as CdpSessionLike,
      isBrowserRunning: () => browserManager.isLaunched(),
    };

    const stream = new ScreencastStreamImpl(provider, _options);
    await stream.start();
    return stream as unknown as ScreencastStream;
  }

  // ---------------------------------------------------------------------------
  // Event Injection (for Studio live view interactivity)
  // ---------------------------------------------------------------------------

  override async injectMouseEvent(event: MouseEventParams): Promise<void> {
    if (!this.browserManager) throw new Error('Browser not launched');
    await this.browserManager.injectMouseEvent(event);
  }

  override async injectKeyboardEvent(event: KeyboardEventParams): Promise<void> {
    if (!this.browserManager) throw new Error('Browser not launched');

    // Use CDP directly to include windowsVirtualKeyCode
    // The agent-browser package's injectKeyboardEvent doesn't pass this field,
    // which breaks non-printable keys like Enter, Backspace, and arrows
    const cdp = await this.browserManager.getCDPSession();
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

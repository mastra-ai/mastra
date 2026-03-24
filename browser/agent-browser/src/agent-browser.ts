import { MastraBrowser } from '@mastra/core/browser';
import type { ScreencastOptions, ScreencastStream } from '@mastra/core/browser';
import type { Tool } from '@mastra/core/tools';
import type { BrowserManagerLike, BrowserPage, BrowserLocator, LaunchOptions } from './browser-types';
import { loadBrowserManager } from './browser-types';
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

  private browserManager: BrowserManagerLike | null = null;
  private defaultTimeout = 30000;

  constructor(config: BrowserConfig = {}) {
    super(config);
    this.id = `agent-browser-${Date.now()}`;
    if (config.timeout) {
      this.defaultTimeout = config.timeout;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected override async doLaunch(): Promise<void> {
    const BrowserManager = await loadBrowserManager();
    this.browserManager = new BrowserManager();

    const localConfig = this.config as BrowserConfig;
    const launchOptions: LaunchOptions = {
      headless: localConfig.headless ?? true,
    };

    // Resolve CDP URL if provided (can be string or function)
    if (localConfig.cdpUrl) {
      const cdpUrl = typeof localConfig.cdpUrl === 'function' ? await localConfig.cdpUrl() : localConfig.cdpUrl;
      launchOptions.cdpEndpoint = cdpUrl;
    }

    await this.browserManager.launch(launchOptions);
  }

  protected override async doClose(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
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

  private getPage(): BrowserPage {
    if (!this.browserManager) throw new Error('Browser not launched');
    return this.browserManager.getPage();
  }

  private requireLocator(ref: string): BrowserLocator | null {
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
    const page = this.getPage();
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
  // 1. browser_goto - Navigate to URL
  // ---------------------------------------------------------------------------

  async goto(input: GotoInput): Promise<{
    success: boolean;
    url: string;
    title: string;
    hint?: string;
  }> {
    const page = this.getPage();

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
  }

  // ---------------------------------------------------------------------------
  // 2. browser_snapshot - Capture accessibility tree
  // ---------------------------------------------------------------------------

  async snapshot(input: SnapshotInput): Promise<{
    success: boolean;
    snapshot: string;
    url: string;
    title: string;
    elementCount: number;
    scroll: string;
    hint?: string;
  }> {
    if (!this.browserManager) throw new Error('Browser not launched');

    const page = this.getPage();
    const rawSnapshot = await this.browserManager.getSnapshot({
      interactive: input.interactiveOnly ?? true,
      compact: true,
    });

    // Transform tree refs from [ref=e1] format to @e1 format for consistency
    const snapshot = (rawSnapshot.snapshot ?? rawSnapshot.tree ?? '').replace(/\[ref=(\w+)\]/g, '@$1');

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
  }

  // ---------------------------------------------------------------------------
  // 3. browser_click - Click on element
  // ---------------------------------------------------------------------------

  async click(input: ClickInput): Promise<{
    success: boolean;
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    if (!locator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
        error: { code: 'stale_ref', message: `Ref ${input.ref} not found. The page has changed.` },
      };
    }

    try {
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
        return {
          success: false,
          url: page.url(),
          hint: 'Take a new snapshot to see what is blocking. Dismiss any modals or scroll the element into view.',
          error: { code: 'element_blocked', message: `Element ${input.ref} is blocked by another element.` },
        };
      }

      if (errorMsg.includes('Timeout')) {
        return {
          success: false,
          url: page.url(),
          hint: 'Take a new snapshot - the element may have moved or the page may have changed.',
          error: { code: 'timeout', message: `Click on ${input.ref} timed out.` },
        };
      }

      return {
        success: false,
        url: page.url(),
        hint: 'Take a new snapshot to see the current page state.',
        error: { code: 'browser_error', message: `Click failed: ${errorMsg}` },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 4. browser_type - Type text into element
  // ---------------------------------------------------------------------------

  async type(input: TypeInput): Promise<{
    success: boolean;
    value?: string;
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    if (!locator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
        error: { code: 'stale_ref', message: `Ref ${input.ref} not found. The page has changed.` },
      };
    }

    try {
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
        return {
          success: false,
          url: page.url(),
          hint: 'Take a new snapshot and look for elements with role "textbox" or "searchbox".',
          error: { code: 'not_editable', message: `Element ${input.ref} is not a text input field.` },
        };
      }

      return {
        success: false,
        url: page.url(),
        hint: 'Take a new snapshot to see the current page state.',
        error: { code: 'browser_error', message: `Type failed: ${errorMsg}` },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. browser_press - Press keyboard key(s)
  // ---------------------------------------------------------------------------

  async press(input: PressInput): Promise<{
    success: boolean;
    url: string;
    hint: string;
  }> {
    const page = this.getPage();
    await page.keyboard.press(input.key);

    return {
      success: true,
      url: page.url(),
      hint: 'Take a new snapshot if the page may have changed.',
    };
  }

  // ---------------------------------------------------------------------------
  // 6. browser_select - Select dropdown option
  // ---------------------------------------------------------------------------

  async select(input: SelectInput): Promise<{
    success: boolean;
    selected: string[];
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    if (!locator) {
      return {
        success: false,
        selected: [],
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to get fresh refs.',
        error: { code: 'stale_ref', message: `Ref ${input.ref} not found. The page has changed.` },
      };
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
  }

  // ---------------------------------------------------------------------------
  // 7. browser_scroll - Scroll page or element
  // ---------------------------------------------------------------------------

  async scroll(input: ScrollInput): Promise<{
    success: boolean;
    position: { x: number; y: number };
    scroll: string;
    hint: string;
  }> {
    const page = this.getPage();

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
  }

  // ---------------------------------------------------------------------------
  // 8. browser_screenshot - Take screenshot
  // ---------------------------------------------------------------------------

  async screenshot(input: ScreenshotInput): Promise<{
    success: boolean;
    base64: string;
  }> {
    const page = this.getPage();

    const options: { fullPage?: boolean; type?: string } = {
      fullPage: input.fullPage ?? false,
    };

    let buffer: Buffer;
    if (input.ref) {
      const locator = this.requireLocator(input.ref);
      if (!locator) {
        throw new Error(`Ref ${input.ref} not found. Take a new snapshot to get fresh refs.`);
      }
      buffer = await locator.screenshot(options);
    } else {
      buffer = await page.screenshot(options);
    }

    return { success: true, base64: buffer.toString('base64') };
  }

  // ---------------------------------------------------------------------------
  // 9. browser_hover - Hover over element
  // ---------------------------------------------------------------------------

  async hover(input: HoverInput): Promise<{
    success: boolean;
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    if (!locator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to get fresh refs.',
        error: { code: 'stale_ref', message: `Ref ${input.ref} not found. The page has changed.` },
      };
    }

    await locator.hover({ timeout: this.defaultTimeout });

    return {
      success: true,
      url: page.url(),
      hint: 'Take a new snapshot to see any hover-triggered elements (dropdowns, tooltips).',
    };
  }

  // ---------------------------------------------------------------------------
  // 10. browser_back - Navigate back
  // ---------------------------------------------------------------------------

  async back(): Promise<{
    success: boolean;
    url: string;
    title: string;
    hint: string;
  }> {
    const page = this.getPage();
    await page.goBack({ timeout: this.defaultTimeout });

    return {
      success: true,
      url: page.url(),
      title: await page.title(),
      hint: 'Take a new snapshot to see the previous page.',
    };
  }

  // ---------------------------------------------------------------------------
  // 11. browser_upload - Upload file(s)
  // ---------------------------------------------------------------------------

  async upload(input: UploadInput): Promise<{
    success: boolean;
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    if (!locator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to get fresh refs.',
        error: { code: 'stale_ref', message: `Ref ${input.ref} not found. The page has changed.` },
      };
    }

    await locator.setInputFiles(input.files, { timeout: this.defaultTimeout });

    return {
      success: true,
      url: page.url(),
      hint: 'File(s) uploaded. Take a snapshot to see updated state.',
    };
  }

  // ---------------------------------------------------------------------------
  // 12. browser_dialog - Handle dialogs (alert/confirm/prompt)
  // ---------------------------------------------------------------------------

  async dialog(input: DialogInput): Promise<{
    success: boolean;
    action: 'accept' | 'dismiss';
    hint: string;
  }> {
    const page = this.getPage();

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
  }

  // ---------------------------------------------------------------------------
  // 13. browser_wait - Wait for element or condition
  // ---------------------------------------------------------------------------

  async wait(input: WaitInput): Promise<{
    success: boolean;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const timeout = input.timeout ?? this.defaultTimeout;

    if (input.ref) {
      const locator = this.requireLocator(input.ref);
      if (!locator) {
        return {
          success: false,
          hint: 'Ref not found. Take a new snapshot to get fresh refs.',
          error: { code: 'stale_ref', message: `Ref ${input.ref} not found.` },
        };
      }

      const state = input.state ?? 'visible';
      await locator.waitFor({ state, timeout });

      return {
        success: true,
        hint: `Element is now ${state}. Take a snapshot to continue.`,
      };
    } else {
      await this.getPage().waitForTimeout(timeout);
      return {
        success: true,
        hint: 'Wait complete. Take a snapshot to see current state.',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 14. browser_tabs - Manage browser tabs
  // ---------------------------------------------------------------------------

  async tabs(input: TabsInput): Promise<unknown> {
    const browser = this.browserManager;
    if (!browser) throw new Error('Browser not launched');

    switch (input.action) {
      case 'list': {
        if (!browser.listTabs) throw new Error('Tab management not supported');
        const tabsList = await browser.listTabs();
        return {
          success: true,
          tabs: tabsList,
          hint: 'Use browser_tabs with action:"switch" and index to change tabs.',
        };
      }

      case 'new': {
        if (!browser.newTab) throw new Error('Tab management not supported');
        const result = await browser.newTab(input.url);
        return {
          success: true,
          ...result,
          hint: 'New tab opened. Take a snapshot to see its content.',
        };
      }

      case 'switch': {
        if (!browser.switchTo) throw new Error('Tab management not supported');
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
        if (!browser.closeTab) throw new Error('Tab management not supported');
        await browser.closeTab(input.index);
        const tabsList = (await browser.listTabs?.()) ?? [];
        return {
          success: true,
          remaining: tabsList.length,
          hint: tabsList.length > 0 ? 'Tab closed. Take a snapshot to see current tab.' : 'All tabs closed.',
        };
      }

      default:
        throw new Error(`Unknown tabs action: ${(input as any).action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 15. browser_drag - Drag element to target
  // ---------------------------------------------------------------------------

  async drag(input: DragInput): Promise<{
    success: boolean;
    url: string;
    hint: string;
    error?: { code: string; message: string };
  }> {
    const page = this.getPage();
    const sourceLocator = this.requireLocator(input.sourceRef);
    const targetLocator = this.requireLocator(input.targetRef);

    if (!sourceLocator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to get fresh refs.',
        error: { code: 'stale_ref', message: `Source ref ${input.sourceRef} not found.` },
      };
    }

    if (!targetLocator) {
      return {
        success: false,
        url: page.url(),
        hint: 'IMPORTANT: Take a new snapshot NOW to get fresh refs.',
        error: { code: 'stale_ref', message: `Target ref ${input.targetRef} not found.` },
      };
    }

    await sourceLocator.dragTo(targetLocator, { timeout: this.defaultTimeout });

    return {
      success: true,
      url: page.url(),
      hint: 'Drag complete. Take a snapshot to see the result.',
    };
  }

  // ---------------------------------------------------------------------------
  // 16. browser_evaluate - Execute JavaScript
  // ---------------------------------------------------------------------------

  async evaluate(input: EvaluateInput): Promise<{
    success: boolean;
    result: unknown;
    hint: string;
  }> {
    const page = this.getPage();
    // Wrap script in an async function to allow return statements
    const wrappedScript = `(async () => { ${input.script} })()`;
    const result = await page.evaluate(wrappedScript);

    return {
      success: true,
      result,
      hint: 'JavaScript executed. Take a snapshot if the page may have changed.',
    };
  }

  // ---------------------------------------------------------------------------
  // 17. browser_close - Close browser
  // ---------------------------------------------------------------------------

  async closeBrowser(): Promise<{
    success: boolean;
    hint: string;
  }> {
    await this.close();
    return {
      success: true,
      hint: 'Browser closed. Call browser_goto to start a new session.',
    };
  }

  // ---------------------------------------------------------------------------
  // Screencast (for Studio live view)
  // ---------------------------------------------------------------------------

  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    const { ScreencastStream: ScreencastStreamClass } = await import('./screencast/index.js');
    if (!this.browserManager) throw new Error('Browser not launched');
    return new ScreencastStreamClass(this.browserManager, _options);
  }
}

export default AgentBrowser;

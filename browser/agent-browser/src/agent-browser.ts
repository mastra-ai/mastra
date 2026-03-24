import { MastraBrowser } from '@mastra/core/browser';
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
  ScreencastOptions,
  ScreencastStream,
} from '@mastra/core/browser';
import type { BrowserManagerLike, BrowserPage, BrowserLocator, LaunchOptions } from './browser-types';
import { loadBrowserManager } from './browser-types';
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

    if (localConfig.cdpUrl) {
      launchOptions.cdpEndpoint = localConfig.cdpUrl;
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
  // Helpers
  // ---------------------------------------------------------------------------

  private getPage(): BrowserPage {
    if (!this.browserManager) throw new Error('Browser not launched');
    return this.browserManager.getPage();
  }

  private requireLocator(ref: string): BrowserLocator {
    if (!this.browserManager) {
      throw new Error('Browser not launched');
    }
    // Use the built-in getLocatorFromRef method which properly converts refs to locators
    const locator = this.browserManager.getLocatorFromRef(ref);
    if (!locator) {
      throw new Error(`Invalid ref "${ref}". Run browser_snapshot first to get valid refs.`);
    }
    return locator;
  }

  // Note: getRefMap() returns raw ref data, not locators.
  // We use getLocatorFromRef() instead when we need actual locators.
  private async updateRefMap(): Promise<void> {
    // This is a no-op now - we rely on getLocatorFromRef() which reads from the internal refMap
    // The refMap is automatically updated by getSnapshot()
  }

  // ---------------------------------------------------------------------------
  // 1. browser_goto - Navigate to URL
  // ---------------------------------------------------------------------------

  async goto(input: GotoInput): Promise<{ success: boolean; url: string; title: string }> {
    const page = this.getPage();
    await page.goto(input.url, {
      timeout: this.defaultTimeout,
      waitUntil: input.waitUntil ?? 'load',
    });
    await this.updateRefMap();
    return {
      success: true,
      url: page.url(),
      title: await page.title(),
    };
  }

  // ---------------------------------------------------------------------------
  // 2. browser_snapshot - Get accessibility tree with refs
  // ---------------------------------------------------------------------------

  async snapshot(input: SnapshotInput): Promise<{
    success: boolean;
    snapshot: string;
    title: string;
    url: string;
    elementCount: number;
  }> {
    if (!this.browserManager) throw new Error('Browser not launched');

    const options: { maxElements?: number; interactiveOnly?: boolean } = {};
    if (input.interactiveOnly !== undefined) {
      options.interactiveOnly = input.interactiveOnly;
    }

    const result = await this.browserManager.getSnapshot(options);
    await this.updateRefMap();

    // result.snapshot or result.tree may be set depending on agent-browser version
    const snapshotText = result.snapshot || result.tree || '';

    return {
      success: true,
      snapshot: snapshotText,
      title: result.title || (await this.getPage().title()),
      url: result.url || this.getPage().url(),
      elementCount: result.elementCount || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. browser_click - Click on element
  // ---------------------------------------------------------------------------

  async click(input: ClickInput): Promise<{ success: boolean }> {
    const locator = this.requireLocator(input.ref);

    await locator.click({
      button: input.button ?? 'left',
      clickCount: input.clickCount ?? 1,
      modifiers: input.modifiers,
      timeout: this.defaultTimeout,
    });

    await this.updateRefMap();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 4. browser_type - Type text into element
  // ---------------------------------------------------------------------------

  async type(input: TypeInput): Promise<{ success: boolean }> {
    const locator = this.requireLocator(input.ref);

    if (input.clear) {
      await locator.fill('', { timeout: this.defaultTimeout });
    }

    if (input.delay) {
      // Type character by character with delay
      await locator.focus();
      for (const char of input.text) {
        await this.getPage().keyboard.press(char);
        await new Promise(r => setTimeout(r, input.delay));
      }
    } else {
      // Use fill for instant input
      await locator.fill(input.text, { timeout: this.defaultTimeout });
    }

    await this.updateRefMap();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 5. browser_press - Press keyboard key(s)
  // ---------------------------------------------------------------------------

  async press(input: PressInput): Promise<{ success: boolean }> {
    const page = this.getPage();
    await page.keyboard.press(input.key);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 6. browser_select - Select dropdown option
  // ---------------------------------------------------------------------------

  async select(input: SelectInput): Promise<{ success: boolean; selected: string[] }> {
    const locator = this.requireLocator(input.ref);

    // Build selection criteria
    const selectValue: { value?: string; label?: string; index?: number } = {};
    if (input.value) selectValue.value = input.value;
    if (input.label) selectValue.label = input.label;
    if (input.index !== undefined) selectValue.index = input.index;

    const selected = await locator.selectOption(selectValue, {
      timeout: this.defaultTimeout,
    });

    await this.updateRefMap();
    return { success: true, selected };
  }

  // ---------------------------------------------------------------------------
  // 7. browser_scroll - Scroll page or element
  // ---------------------------------------------------------------------------

  async scroll(input: ScrollInput): Promise<{ success: boolean }> {
    const page = this.getPage();

    if (input.ref) {
      // Scroll element into view
      const locator = this.requireLocator(input.ref);
      await locator.scrollIntoViewIfNeeded({ timeout: this.defaultTimeout });
    } else {
      // Scroll by direction
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

    await this.updateRefMap();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 8. browser_screenshot - Take screenshot
  // ---------------------------------------------------------------------------

  async screenshot(input: ScreenshotInput): Promise<{ success: boolean; base64: string }> {
    const page = this.getPage();

    const options: { fullPage?: boolean; type?: string } = {
      fullPage: input.fullPage ?? false,
    };

    let buffer: Buffer;
    if (input.ref) {
      const locator = this.requireLocator(input.ref);
      buffer = await locator.screenshot(options);
    } else {
      buffer = await page.screenshot(options);
    }

    return { success: true, base64: buffer.toString('base64') };
  }

  // ---------------------------------------------------------------------------
  // 9. browser_hover - Hover over element
  // ---------------------------------------------------------------------------

  async hover(input: HoverInput): Promise<{ success: boolean }> {
    const locator = this.requireLocator(input.ref);
    await locator.hover({ timeout: this.defaultTimeout });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 10. browser_back - Navigate back
  // ---------------------------------------------------------------------------

  async back(): Promise<{ success: boolean; url: string }> {
    const page = this.getPage();
    await page.goBack({ timeout: this.defaultTimeout });
    await this.updateRefMap();
    return { success: true, url: page.url() };
  }

  // ---------------------------------------------------------------------------
  // 11. browser_upload - Upload file(s)
  // ---------------------------------------------------------------------------

  async upload(input: UploadInput): Promise<{ success: boolean }> {
    const locator = this.requireLocator(input.ref);
    await locator.setInputFiles(input.files, { timeout: this.defaultTimeout });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 12. browser_dialog - Handle dialogs (alert/confirm/prompt)
  // ---------------------------------------------------------------------------

  async dialog(input: DialogInput): Promise<{ success: boolean }> {
    const page = this.getPage();

    // Set up dialog handler for next dialog
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dialog handler timed out'));
      }, this.defaultTimeout);

      (page as any).once('dialog', async (dialog: any) => {
        clearTimeout(timeout);
        try {
          if (input.action === 'accept') {
            await dialog.accept(input.text);
          } else {
            await dialog.dismiss();
          }
          resolve({ success: true });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 13. browser_wait - Wait for element or condition
  // ---------------------------------------------------------------------------

  async wait(input: WaitInput): Promise<{ success: boolean }> {
    const timeout = input.timeout ?? this.defaultTimeout;

    if (input.ref) {
      const locator = this.requireLocator(input.ref);
      const state = input.state ?? 'visible';
      await locator.waitFor({ state, timeout });
    } else {
      // Wait for timeout (simple delay)
      await this.getPage().waitForTimeout(timeout);
    }

    await this.updateRefMap();
    return { success: true };
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
        return { success: true, tabs: tabsList };
      }

      case 'new': {
        if (!browser.newTab) throw new Error('Tab management not supported');
        const result = await browser.newTab(input.url);
        await this.updateRefMap();
        return { success: true, ...result };
      }

      case 'switch': {
        if (!browser.switchTo) throw new Error('Tab management not supported');
        await browser.switchTo(input.index!);
        await this.updateRefMap();
        const page = browser.getPage();
        return { success: true, index: input.index, url: page.url(), title: await page.title() };
      }

      case 'close': {
        if (!browser.closeTab) throw new Error('Tab management not supported');
        await browser.closeTab(input.index);
        const tabsList = (await browser.listTabs?.()) ?? [];
        return { success: true, remaining: tabsList.length };
      }

      default:
        throw new Error(`Unknown tabs action: ${(input as any).action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 15. browser_drag - Drag element to target
  // ---------------------------------------------------------------------------

  async drag(input: DragInput): Promise<{ success: boolean }> {
    const sourceLocator = this.requireLocator(input.sourceRef);
    const targetLocator = this.requireLocator(input.targetRef);

    await sourceLocator.dragTo(targetLocator, { timeout: this.defaultTimeout });
    await this.updateRefMap();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 16. browser_evaluate - Execute JavaScript
  // ---------------------------------------------------------------------------

  async evaluate(input: EvaluateInput): Promise<{ success: boolean; result: unknown }> {
    const page = this.getPage();
    const result = await page.evaluate(input.script);
    return { success: true, result };
  }

  // ---------------------------------------------------------------------------
  // Screencast (for Studio live view)
  // ---------------------------------------------------------------------------

  async startScreencast(_options?: ScreencastOptions): Promise<ScreencastStream> {
    // Import ScreencastStream from local module
    const { ScreencastStream: ScreencastStreamClass } = await import('./screencast/index.js');
    if (!this.browserManager) throw new Error('Browser not launched');
    return new ScreencastStreamClass(this.browserManager, _options);
  }
}

export default AgentBrowser;

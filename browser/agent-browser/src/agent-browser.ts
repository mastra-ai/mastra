import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MastraBrowser } from '@mastra/core/browser';

import type { BrowserManagerLike, BrowserLocator, BrowserPage } from './browser-types.js';
import { ScreencastStream } from './screencast/index.js';
import type { ScreencastOptions } from './screencast/index.js';
import type { BrowserConfig } from './types.js';

/**
 * AgentBrowser - Browser provider using vercel-labs/agent-browser
 *
 * Implements all 19 grouped methods from MastraBrowser base class.
 * Methods perform raw browser operations and return simple results.
 * Error handling and LLM-friendly hints are added at the tool level in core.
 */
export class AgentBrowser extends MastraBrowser {
  readonly id = 'agent-browser';
  readonly name = 'Agent Browser';
  readonly provider = 'vercel-labs/agent-browser';

  private browserManager: BrowserManagerLike | null = null;
  private screencastStream: ScreencastStream | null = null;

  private agentBrowserConfig: BrowserConfig;
  private defaultTimeout: number;

  constructor(config: BrowserConfig = {}) {
    super(config);
    this.agentBrowserConfig = config;
    this.defaultTimeout = config.timeout ?? 30000;
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private getPage(): BrowserPage {
    if (!this.browserManager) {
      throw new Error('Browser not launched');
    }
    return this.browserManager.getPage();
  }

  private getLocator(ref: string): BrowserLocator | null {
    if (!this.browserManager) return null;
    return this.browserManager.getLocatorFromRef(ref);
  }

  private requireLocator(ref: string): BrowserLocator {
    const locator = this.getLocator(ref);
    if (!locator) {
      throw new Error(`STALE_REF:${ref}`);
    }
    return locator;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (called by base class _launch/_close wrappers)
  // ---------------------------------------------------------------------------

  protected async launch(): Promise<void> {
    if (this.browserManager) return;

    const { BrowserManager } = (await import('agent-browser')) as unknown as {
      BrowserManager: new (config: BrowserConfig) => BrowserManagerLike;
    };

    this.browserManager = new BrowserManager({
      headless: this.config.headless ?? true,
      timeout: this.defaultTimeout,
      ...this.agentBrowserConfig,
    });

    await this.browserManager.launch({
      id: this.id,
      action: 'launch',
      headless: this.agentBrowserConfig.headless ?? true,
    });
    this.logger.info('Browser launched');
  }

  protected async close(): Promise<void> {
    if (this.screencastStream) {
      await this.screencastStream.stop();
      this.screencastStream = null;
    }
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
    this.logger.info('Browser closed');
  }

  // ---------------------------------------------------------------------------
  // Screencast
  // ---------------------------------------------------------------------------

  override async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    if (!this.browserManager) {
      throw new Error('Browser not launched');
    }

    if (this.screencastStream) {
      await this.screencastStream.stop();
    }

    this.screencastStream = new ScreencastStream(this.browserManager, options);
    await this.screencastStream.start();
    return this.screencastStream;
  }

  async stopScreencast(): Promise<void> {
    if (this.screencastStream) {
      await this.screencastStream.stop();
      this.screencastStream = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Navigate: goto, back, forward, reload, close
  // ---------------------------------------------------------------------------

  async navigate(input: { action: string; url?: string; waitUntil?: string }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'goto':
        await page.goto(input.url!, {
          timeout: this.defaultTimeout,
          waitUntil: (input.waitUntil as 'load' | 'domcontentloaded' | 'networkidle') ?? 'domcontentloaded',
        });
        return { success: true, url: page.url(), title: await page.title() };

      case 'back':
        await page.goBack({ timeout: this.defaultTimeout });
        return { success: true, url: page.url(), title: await page.title() };

      case 'forward':
        await page.goForward({ timeout: this.defaultTimeout });
        return { success: true, url: page.url(), title: await page.title() };

      case 'reload':
        await page.reload({ timeout: this.defaultTimeout });
        return { success: true, url: page.url(), title: await page.title() };

      case 'close':
        await this.close();
        return { success: true };

      default:
        throw new Error(`Unknown navigate action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Interact: click, double_click, hover, focus, drag, tap
  // ---------------------------------------------------------------------------

  async interact(input: {
    action: string;
    ref?: string;
    sourceRef?: string;
    targetRef?: string;
    button?: string;
    clickCount?: number;
  }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'click': {
        const locator = this.requireLocator(input.ref!);
        await locator.click({ button: input.button, timeout: this.defaultTimeout, clickCount: input.clickCount });
        return { success: true, url: page.url() };
      }

      case 'double_click': {
        const locator = this.requireLocator(input.ref!);
        await locator.dblclick({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      case 'hover': {
        const locator = this.requireLocator(input.ref!);
        await locator.hover({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      case 'focus': {
        const locator = this.requireLocator(input.ref!);
        await locator.focus({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      case 'drag': {
        const source = this.requireLocator(input.sourceRef!);
        const target = this.requireLocator(input.targetRef!);
        await source.dragTo(target, { timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      case 'tap': {
        const locator = this.requireLocator(input.ref!);
        await locator.tap({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      default:
        throw new Error(`Unknown interact action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Input: fill, type, press, clear, select_all
  // ---------------------------------------------------------------------------

  async input(input: {
    action: string;
    ref: string;
    value?: string;
    text?: string;
    key?: string;
    delay?: number;
  }): Promise<unknown> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    switch (input.action) {
      case 'fill':
        await locator.fill(input.value!, { timeout: this.defaultTimeout });
        return { success: true, url: page.url() };

      case 'type':
        await locator.focus({ timeout: this.defaultTimeout });
        await page.keyboard.type(input.text!, { delay: input.delay ?? 0 });
        return { success: true, url: page.url() };

      case 'press':
        await locator.focus({ timeout: this.defaultTimeout });
        await page.keyboard.press(input.key!, { delay: input.delay ?? 0 });
        return { success: true, url: page.url() };

      case 'clear':
        await locator.clear({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };

      case 'select_all':
        await locator.selectText({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };

      default:
        throw new Error(`Unknown input action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Keyboard: type, insert_text, key_down, key_up
  // ---------------------------------------------------------------------------

  async keyboard(input: { action: string; text?: string; key?: string; delay?: number }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'type':
        await page.keyboard.type(input.text!, { delay: input.delay ?? 0 });
        return { success: true };

      case 'insert_text':
        await page.keyboard.insertText(input.text!);
        return { success: true };

      case 'key_down':
        await page.keyboard.down(input.key!);
        return { success: true };

      case 'key_up':
        await page.keyboard.up(input.key!);
        return { success: true };

      default:
        throw new Error(`Unknown keyboard action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Form: select, check, uncheck, upload
  // ---------------------------------------------------------------------------

  async form(input: { action: string; ref: string; index?: number; files?: string[] }): Promise<unknown> {
    const page = this.getPage();
    const locator = this.requireLocator(input.ref);

    switch (input.action) {
      case 'select': {
        const selected = await locator.selectOption({ index: input.index }, { timeout: this.defaultTimeout });
        return { success: true, selected, url: page.url() };
      }

      case 'check':
        await locator.check({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };

      case 'uncheck':
        await locator.uncheck({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };

      case 'upload':
        await locator.setInputFiles(input.files!);
        return { success: true, files: input.files, url: page.url() };

      default:
        throw new Error(`Unknown form action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Scroll: scroll, into_view
  // ---------------------------------------------------------------------------

  async scroll(input: { action: string; ref?: string; direction?: string; amount?: number }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'scroll': {
        const direction = input.direction ?? 'down';
        const amount = input.amount ?? 300;
        let deltaX = 0,
          deltaY = 0;

        if (direction === 'up') deltaY = -amount;
        else if (direction === 'down') deltaY = amount;
        else if (direction === 'left') deltaX = -amount;
        else if (direction === 'right') deltaX = amount;

        if (input.ref) {
          const locator = this.requireLocator(input.ref);
          await locator.evaluate((el, args: number[]) => el.scrollBy(args[0]!, args[1]!), [deltaX, deltaY]);
        } else {
          await page.evaluate(`window.scrollBy(${deltaX}, ${deltaY})`);
        }

        const scrollInfo = await page.evaluate(`({
          scrollY: Math.round(window.scrollY),
          atTop: window.scrollY < 50,
          atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 50
        })`);
        return { success: true, ...(scrollInfo as object) };
      }

      case 'into_view': {
        const locator = this.requireLocator(input.ref!);
        await locator.scrollIntoViewIfNeeded({ timeout: this.defaultTimeout });
        return { success: true, url: page.url() };
      }

      default:
        throw new Error(`Unknown scroll action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Extract: snapshot, screenshot, text, html, value, attribute, title, url, count, bounding_box, styles, evaluate
  // ---------------------------------------------------------------------------

  async extract(input: {
    action: string;
    ref?: string;
    fullPage?: boolean;
    quality?: number;
    outer?: boolean;
    name?: string;
    properties?: string[];
    script?: string;
    interactiveOnly?: boolean;
    maxElements?: number;
    offset?: number;
  }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'snapshot': {
        if (!this.browserManager) throw new Error('Browser not launched');

        const snapshot = await this.browserManager.getSnapshot({
          interactive: input.interactiveOnly ?? true,
          compact: true,
        });

        const url = page.url();
        const title = await page.title();
        const maxElements = input.maxElements ?? 50;
        const offset = input.offset ?? 0;

        // Transform refs and filter
        let tree = snapshot.tree.replace(/\[ref=(\w+)\]/g, '@$1');
        const lines = tree.split('\n').filter(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('- option ')) return false;
          if (/, (shift, )?option, \w"/.test(line)) return false;
          return true;
        });

        // Paginate
        const refPattern = /@e(\d+)/g;
        const filteredLines: string[] = [];
        let seenCount = 0,
          includedCount = 0;

        for (const line of lines) {
          if (line.match(refPattern)) {
            if (seenCount >= offset && includedCount < maxElements) {
              filteredLines.push(line);
              includedCount++;
            }
            seenCount++;
          } else if (seenCount >= offset && includedCount < maxElements) {
            filteredLines.push(line);
          }
          if (includedCount >= maxElements) break;
        }

        const hasMore = seenCount > offset + maxElements;
        const header = [`Page: ${title}`, `URL: ${url}`, `Elements: ${offset + 1}-${offset + includedCount}`];
        if (hasMore) header.push(`[More elements - use offset:${offset + maxElements}]`);

        return {
          success: true,
          snapshot: header.join('\n') + '\n\n' + filteredLines.join('\n'),
          elementCount: seenCount,
          hasMore,
          url,
          title,
        };
      }

      case 'screenshot': {
        let buffer: Buffer;
        let dimensions: { width: number; height: number };

        if (input.ref) {
          const locator = this.requireLocator(input.ref);
          buffer = await locator.screenshot({ type: 'png', timeout: this.defaultTimeout });
          const box = await locator.boundingBox();
          dimensions = box ? { width: Math.round(box.width), height: Math.round(box.height) } : { width: 0, height: 0 };
        } else if (input.fullPage) {
          dimensions = (await page.evaluate(
            '({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })',
          )) as { width: number; height: number };
          buffer = await page.screenshot({ fullPage: true, type: 'png', timeout: this.defaultTimeout });
        } else {
          const viewport = page.viewportSize();
          dimensions = viewport ?? { width: 0, height: 0 };
          buffer = await page.screenshot({ type: 'png', timeout: this.defaultTimeout });
        }

        // Save to disk
        const screenshotDir = join(process.cwd(), 'screenshots');
        await mkdir(screenshotDir, { recursive: true });
        const filename = `screenshot-${Date.now()}.png`;
        const filepath = join(screenshotDir, filename);
        await writeFile(filepath, buffer);

        return {
          success: true,
          base64: buffer.toString('base64'),
          mimeType: 'image/png',
          dimensions,
          fileSize: buffer.length,
          filepath,
          url: page.url(),
          title: await page.title(),
        };
      }

      case 'text': {
        const locator = this.requireLocator(input.ref!);
        return { success: true, text: await locator.textContent() };
      }

      case 'html': {
        const locator = this.requireLocator(input.ref!);
        const html = await locator.evaluate(el => el.outerHTML);
        return { success: true, html };
      }

      case 'value': {
        const locator = this.requireLocator(input.ref!);
        return { success: true, value: await locator.inputValue() };
      }

      case 'attribute': {
        const locator = this.requireLocator(input.ref!);
        return { success: true, value: await locator.getAttribute(input.name!) };
      }

      case 'title':
        return { success: true, title: await page.title() };

      case 'url':
        return { success: true, url: page.url() };

      case 'count':
        return { success: true, count: 1 }; // Single ref = 1 element

      case 'bounding_box': {
        const locator = this.requireLocator(input.ref!);
        return { success: true, box: await locator.boundingBox() };
      }

      case 'styles': {
        const locator = this.requireLocator(input.ref!);
        const props = input.properties ?? [];
        const styles = await locator.evaluate((el, properties: string[]) => {
          const computed = (globalThis as any).getComputedStyle(el);
          const result: Record<string, string> = {};
          if (properties.length === 0) {
            for (let i = 0; i < computed.length; i++) {
              result[computed[i]] = computed.getPropertyValue(computed[i]);
            }
          } else {
            for (const prop of properties) {
              result[prop] = computed.getPropertyValue(prop);
            }
          }
          return result;
        }, props);
        return { success: true, styles };
      }

      case 'evaluate':
        return { success: true, result: await page.evaluate(input.script!) };

      default:
        throw new Error(`Unknown extract action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Element State: is_visible, is_enabled, is_checked
  // ---------------------------------------------------------------------------

  async elementState(input: { action: string; ref: string }): Promise<unknown> {
    const locator = this.requireLocator(input.ref);

    switch (input.action) {
      case 'is_visible': {
        const box = await locator.boundingBox();
        return { success: true, visible: box !== null };
      }

      case 'is_enabled': {
        const disabled = await locator.evaluate(el => (el as any).disabled ?? false);
        return { success: true, enabled: !disabled };
      }

      case 'is_checked':
        return { success: true, checked: await locator.isChecked() };

      default:
        throw new Error(`Unknown elementState action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Browser State: set_viewport, set_credentials, get_cookies, set_cookie, clear_cookies
  // ---------------------------------------------------------------------------

  async browserState(input: {
    action: string;
    width?: number;
    height?: number;
    username?: string;
    password?: string;
    urls?: string[];
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'set_viewport':
        await page.setViewportSize({ width: input.width!, height: input.height! });
        return { success: true, width: input.width, height: input.height };

      case 'set_credentials':
        await page.context().setHTTPCredentials({ username: input.username!, password: input.password! });
        return { success: true };

      case 'get_cookies':
        return { success: true, cookies: await page.context().cookies(input.urls) };

      case 'set_cookie':
        await page.context().addCookies([
          {
            name: input.name!,
            value: input.value!,
            domain: input.domain,
            path: input.path ?? '/',
            expires: input.expires,
            httpOnly: input.httpOnly,
            secure: input.secure,
            sameSite: input.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
          },
        ]);
        return { success: true };

      case 'clear_cookies':
        await page.context().clearCookies();
        return { success: true };

      default:
        throw new Error(`Unknown browserState action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Storage: localStorage/sessionStorage get, set, clear
  // ---------------------------------------------------------------------------

  async storage(input: { type: string; action: string; key?: string; value?: string }): Promise<unknown> {
    const page = this.getPage();
    const storageType = input.type === 'session' ? 'sessionStorage' : 'localStorage';

    switch (input.action) {
      case 'get': {
        const data = await page.evaluate(
          (args: { storage: string; key?: string }) => {
            const s = args.storage === 'sessionStorage' ? sessionStorage : localStorage;
            if (args.key) {
              const value = s.getItem(args.key);
              return value !== null ? { [args.key]: value } : {};
            }
            const result: Record<string, string> = {};
            for (let i = 0; i < s.length; i++) {
              const k = s.key(i);
              if (k) result[k] = s.getItem(k) || '';
            }
            return result;
          },
          { storage: storageType, key: input.key },
        );
        return { success: true, data, url: page.url() };
      }

      case 'set':
        await page.evaluate(
          (args: { storage: string; key: string; value: string }) => {
            const s = args.storage === 'sessionStorage' ? sessionStorage : localStorage;
            s.setItem(args.key, args.value);
          },
          { storage: storageType, key: input.key!, value: input.value! },
        );
        return { success: true, url: page.url() };

      case 'clear':
        await page.evaluate((storage: string) => {
          const s = storage === 'sessionStorage' ? sessionStorage : localStorage;
          s.clear();
        }, storageType);
        return { success: true, url: page.url() };

      default:
        throw new Error(`Unknown storage action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 11. Emulation: device, media, geolocation, offline, headers
  // ---------------------------------------------------------------------------

  async emulation(input: {
    action: string;
    device?: string;
    colorScheme?: string;
    reducedMotion?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    offline?: boolean;
    headers?: Record<string, string>;
  }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'device': {
        const getDevice = (this.browserManager as any)?.getDevice;
        const deviceConfig = getDevice?.(input.device);
        if (!deviceConfig) throw new Error(`Unknown device: ${input.device}`);
        await page.setViewportSize(deviceConfig.viewport);
        return { success: true, device: input.device };
      }

      case 'media': {
        const cdp = await (this.browserManager as any)?.getCDPSession?.();
        if (cdp) {
          await cdp.send('Emulation.setEmulatedMedia', {
            media: 'screen',
            features: [
              { name: 'prefers-color-scheme', value: input.colorScheme ?? 'light' },
              { name: 'prefers-reduced-motion', value: input.reducedMotion ?? 'no-preference' },
            ],
          });
        }
        return { success: true };
      }

      case 'geolocation': {
        const cdp = await (this.browserManager as any)?.getCDPSession?.();
        if (cdp) {
          await cdp.send('Emulation.setGeolocationOverride', {
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy ?? 1,
          });
        }
        return { success: true };
      }

      case 'offline': {
        const cdp = await (this.browserManager as any)?.getCDPSession?.();
        if (cdp) {
          await cdp.send('Network.emulateNetworkConditions', {
            offline: input.offline,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
        }
        return { success: true, offline: input.offline };
      }

      case 'headers': {
        const setHeaders = (page.context() as any)?.setExtraHTTPHeaders;
        if (setHeaders) await setHeaders(input.headers);
        return { success: true };
      }

      default:
        throw new Error(`Unknown emulation action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Frames: switch, main
  // ---------------------------------------------------------------------------

  async frames(input: { action: string; selector?: string; name?: string; url?: string }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'switch': {
        const frame = (page as any).frames?.().find((f: any) => {
          if (input.name && f.name() === input.name) return true;
          if (input.url && f.url().includes(input.url)) return true;
          return false;
        });
        if (!frame) throw new Error('Frame not found');
        return { success: true, frame: frame.name?.() };
      }

      case 'main':
        return { success: true };

      default:
        throw new Error(`Unknown frames action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 13. Dialogs: handle, clear
  // ---------------------------------------------------------------------------

  async dialogs(input: { action: string; accept?: boolean; promptText?: string }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'handle':
        (page as any).on?.('dialog', async (dialog: any) => {
          if (input.accept) await dialog.accept(input.promptText);
          else await dialog.dismiss();
        });
        return { success: true, willAccept: input.accept };

      case 'clear':
        (page as any).removeAllListeners?.('dialog');
        return { success: true };

      default:
        throw new Error(`Unknown dialogs action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 14. Tabs: list, new, switch, close
  // ---------------------------------------------------------------------------

  async tabs(input: { action: string; url?: string; index?: number }): Promise<unknown> {
    const browser = this.browserManager;
    if (!browser) throw new Error('Browser not launched');

    switch (input.action) {
      case 'list': {
        if (!browser.listTabs) throw new Error('Tab management not supported');
        const tabs = await browser.listTabs();
        return { success: true, tabs };
      }

      case 'new': {
        if (!browser.newTab) throw new Error('Tab management not supported');
        const result = await browser.newTab(input.url);
        return { success: true, ...result };
      }

      case 'switch': {
        if (!browser.switchTo) throw new Error('Tab management not supported');
        await browser.switchTo(input.index!);
        const page = browser.getPage();
        return { success: true, index: input.index, url: page.url(), title: await page.title() };
      }

      case 'close': {
        if (!browser.closeTab) throw new Error('Tab management not supported');
        await browser.closeTab(input.index);
        const tabs = (await browser.listTabs?.()) ?? [];
        return { success: true, remaining: tabs.length };
      }

      default:
        throw new Error(`Unknown tabs action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 15. Recording: record_start, record_stop, trace_start, trace_stop
  // ---------------------------------------------------------------------------

  async recording(input: {
    action: string;
    path?: string;
    screenshots?: boolean;
    snapshots?: boolean;
  }): Promise<unknown> {
    const browser = this.browserManager;
    if (!browser) throw new Error('Browser not launched');

    switch (input.action) {
      case 'record_start':
        if (!browser.startRecording) throw new Error('Recording not supported');
        await browser.startRecording(input.path!);
        return { success: true, path: input.path };

      case 'record_stop':
        if (!browser.stopRecording) throw new Error('Recording not supported');
        return { success: true, path: await browser.stopRecording() };

      case 'trace_start':
        if (!browser.startTracing) throw new Error('Tracing not supported');
        await browser.startTracing({ screenshots: input.screenshots ?? true, snapshots: input.snapshots ?? true });
        return { success: true };

      case 'trace_stop':
        if (!browser.stopTracing) throw new Error('Tracing not supported');
        await browser.stopTracing(input.path!);
        return { success: true, path: input.path };

      default:
        throw new Error(`Unknown recording action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 16. Monitoring: network/console/errors start, get, clear
  // ---------------------------------------------------------------------------

  private networkRequests: Array<{ url: string; method: string; status?: number; timestamp: number }> = [];
  private consoleMessages: Array<{ type: string; text: string; timestamp: number }> = [];
  private pageErrors: Array<{ message: string; timestamp: number }> = [];
  private isTrackingNetwork = false;
  private isTrackingConsole = false;
  private isTrackingErrors = false;

  async monitoring(input: { type: string; action: string }): Promise<unknown> {
    const page = this.getPage();
    const onEvent = (page as any).on;

    if (input.type === 'network') {
      switch (input.action) {
        case 'start':
          if (!this.isTrackingNetwork && onEvent) {
            onEvent('request', (req: any) =>
              this.networkRequests.push({ url: req.url(), method: req.method(), timestamp: Date.now() }),
            );
            onEvent('response', (res: any) => {
              const entry = this.networkRequests.find(r => r.url === res.url() && !r.status);
              if (entry) entry.status = res.status();
            });
            this.isTrackingNetwork = true;
          }
          return { success: true };
        case 'get':
          return { success: true, requests: this.networkRequests };
        case 'clear':
          this.networkRequests = [];
          return { success: true };
      }
    }

    if (input.type === 'console') {
      switch (input.action) {
        case 'start':
          if (!this.isTrackingConsole && onEvent) {
            onEvent('console', (msg: any) =>
              this.consoleMessages.push({ type: msg.type(), text: msg.text(), timestamp: Date.now() }),
            );
            this.isTrackingConsole = true;
          }
          return { success: true };
        case 'get':
          return { success: true, messages: this.consoleMessages };
        case 'clear':
          this.consoleMessages = [];
          return { success: true };
      }
    }

    if (input.type === 'errors') {
      switch (input.action) {
        case 'start':
          if (!this.isTrackingErrors && onEvent) {
            onEvent('pageerror', (error: any) =>
              this.pageErrors.push({ message: error.message || String(error), timestamp: Date.now() }),
            );
            this.isTrackingErrors = true;
          }
          return { success: true };
        case 'get':
          return { success: true, errors: this.pageErrors };
        case 'clear':
          this.pageErrors = [];
          return { success: true };
      }
    }

    throw new Error(`Unknown monitoring type/action: ${input.type}/${input.action}`);
  }

  // ---------------------------------------------------------------------------
  // 17. Clipboard: copy, paste, read, write
  // ---------------------------------------------------------------------------

  async clipboard(input: { action: string; ref?: string; text?: string }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'copy': {
        const locator = this.requireLocator(input.ref!);
        await locator.selectText({ timeout: this.defaultTimeout });
        await page.keyboard.press('Control+c');
        return { success: true };
      }

      case 'paste': {
        const locator = this.requireLocator(input.ref!);
        await locator.focus({ timeout: this.defaultTimeout });
        await page.keyboard.press('Control+v');
        return { success: true };
      }

      case 'read':
        return { success: true, text: await page.evaluate('navigator.clipboard.readText()') };

      case 'write':
        await page.evaluate(`navigator.clipboard.writeText(${JSON.stringify(input.text)})`);
        return { success: true };

      default:
        throw new Error(`Unknown clipboard action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 18. Debug: inspect, highlight
  // ---------------------------------------------------------------------------

  async debug(input: { action: string; ref: string; duration?: number }): Promise<unknown> {
    const locator = this.requireLocator(input.ref);

    switch (input.action) {
      case 'inspect':
        return {
          success: true,
          info: await locator.evaluate(el => ({
            tagName: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            attributes: Array.from(el.attributes).map((a: any) => ({ name: a.name, value: a.value })),
            textContent: el.textContent?.slice(0, 100),
            rect: el.getBoundingClientRect().toJSON(),
          })),
        };

      case 'highlight': {
        const duration = input.duration ?? 2000;
        await locator.evaluate((el, ms: number) => {
          const orig = el.style.outline;
          el.style.outline = '3px solid red';
          setTimeout(() => {
            el.style.outline = orig;
          }, ms);
        }, duration);
        return { success: true };
      }

      default:
        throw new Error(`Unknown debug action: ${input.action}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 19. Wait: wait for element state, page load, or timeout
  // ---------------------------------------------------------------------------

  async wait(input: { action: string; ref?: string; state?: string; timeout?: number; ms?: number }): Promise<unknown> {
    const page = this.getPage();

    switch (input.action) {
      case 'element': {
        if (!input.ref) {
          throw new Error('ref is required for element wait');
        }
        const locator = this.requireLocator(input.ref);
        await locator.waitFor({
          state: (input.state as 'visible' | 'hidden' | 'attached' | 'detached') ?? 'visible',
          timeout: input.timeout ?? this.defaultTimeout,
        });
        return { success: true, action: 'element', ref: input.ref, state: input.state ?? 'visible' };
      }

      case 'load': {
        const loadState = (input.state as 'load' | 'domcontentloaded' | 'networkidle') ?? 'networkidle';
        await page.waitForLoadState(loadState, { timeout: input.timeout ?? this.defaultTimeout });
        return { success: true, action: 'load', state: loadState };
      }

      case 'timeout': {
        const ms = input.ms ?? 1000;
        await page.waitForTimeout(ms);
        return { success: true, action: 'timeout', ms };
      }

      default:
        throw new Error(`Unknown wait action: ${input.action}`);
    }
  }
}

import { homedir } from 'node:os';

import { chromium } from 'playwright-core';
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  CDPSession,
  LaunchOptions,
  Locator,
  Page,
} from 'playwright-core';

/**
 * Options for {@link BrowserManager.launch}.
 */
export interface BrowserLaunchOptions {
  /** Run without a visible window. Defaults to `true`. */
  headless?: boolean;
  /**
   * Page viewport. `null` disables viewport emulation (the window size wins).
   * Defaults to 1280x720 unless `args` sets the window size.
   */
  viewport?: { width: number; height: number } | null;
  /** Extra Chrome launch args. */
  args?: string[];
  /** Chrome user data directory (persistent cookies, storage and extensions). */
  profile?: string;
  /** Path to the Chrome/Chromium executable. */
  executablePath?: string;
  /**
   * Playwright browser channel such as `'chrome'`, `'chrome-beta'` or `'msedge'`.
   * Ignored when `executablePath` is set.
   */
  channel?: string;
  /** Path to a Playwright storage state JSON file. */
  storageState?: string;
  /** Connect to an existing browser instead of launching one. */
  cdpUrl?: string;
  /** Headers sent with the CDP websocket handshake (e.g. Authorization). */
  cdpHeaders?: Record<string, string>;
  userAgent?: string;
  /** Proxy server URL, e.g. `http://proxy.example.com:8080`. */
  proxy?: string;
  ignoreHTTPSErrors?: boolean;
}

/** Element described by a snapshot ref. */
export interface SnapshotRef {
  role: string;
  name?: string;
}

export interface EnhancedSnapshot {
  tree: string;
  refs: Record<string, SnapshotRef>;
}

export interface SnapshotOptions {
  /** Only list interactive elements (buttons, links, inputs, ...), flattened. */
  interactive?: boolean;
  /** Drop unnamed structural wrappers (generic, group, list, ...). */
  compact?: boolean;
  /** Maximum depth of the accessibility tree. */
  depth?: number;
}

export interface MouseEventInput {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'none';
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
  modifiers?: number;
}

const CONNECT_TIMEOUT_MS = 60_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

/** Message used when neither Playwright's Chromium nor an installed Chrome is available. */
export const CHROME_NOT_FOUND_MESSAGE =
  'Chrome executable not found. Install Google Chrome, run `npx playwright install chromium`, or set `executablePath`.';

/** Refs from Playwright's AI snapshot: `e12` on the page, `f1e3` inside the first iframe. */
const REF_PATTERN = /^(?:f\d+)?e\d+$/;

const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem',
]);

const STRUCTURAL_ROLES = new Set([
  'application',
  'directory',
  'document',
  'generic',
  'grid',
  'group',
  'list',
  'menu',
  'menubar',
  'none',
  'presentation',
  'row',
  'rowgroup',
  'table',
  'tablist',
  'toolbar',
  'tree',
  'treegrid',
]);

/** Normalize `e1`, `@e1`, `ref=e1` (and frame refs like `@f1e2`) to the bare ref. */
export function parseRef(arg: string): string | null {
  const ref = arg.trim().replace(/^@/, '').replace(/^ref=/, '');
  return REF_PATTERN.test(ref) ? ref : null;
}

function normalizeCdpEndpoint(endpoint: string): string {
  if (/^(wss?|https?):\/\//.test(endpoint)) return endpoint;
  return `http://127.0.0.1:${endpoint}`;
}

function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') ? homedir() + path.slice(1) : path;
}

function resolveViewport(options: BrowserLaunchOptions): { width: number; height: number } | null {
  if (options.viewport !== undefined) return options.viewport;
  const sizedByArgs = options.args?.some(arg => arg === '--start-maximized' || arg.startsWith('--window-size='));
  return sizedByArgs ? null : DEFAULT_VIEWPORT;
}

function isMissingExecutable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Executable doesn't exist") || /distribution '[^']+' is not found/.test(message);
}

/**
 * Launch with Playwright's Chromium, falling back to an installed Google Chrome
 * when Playwright's browsers aren't downloaded. An explicit `executablePath` or
 * `channel` is used as-is.
 */
async function launchWithChromeFallback<T>(
  launch: (options: LaunchOptions) => Promise<T>,
  options: LaunchOptions,
): Promise<T> {
  if (options.executablePath || options.channel) return launch(options);
  try {
    return await launch(options);
  } catch (error) {
    if (!isMissingExecutable(error)) throw error;
    try {
      return await launch({ ...options, channel: 'chrome' });
    } catch (fallbackError) {
      if (!isMissingExecutable(fallbackError)) throw fallbackError;
      throw new Error(CHROME_NOT_FOUND_MESSAGE, { cause: error });
    }
  }
}

interface SnapshotLine {
  indent: number;
  /** Line content without the `- ` marker and YAML quoting. */
  text: string;
  role?: string;
  name?: string;
  ref?: string;
  /** Text after the element's attributes, e.g. a textbox value (`: v`). */
  hasInlineText: boolean;
}

function unescapeName(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

function parseSnapshotLine(line: string): SnapshotLine | null {
  const match = /^(\s*)- (.*)$/.exec(line);
  if (!match) return null;
  const indent = match[1]!.length;
  let text = match[2]!;

  // Playwright YAML-quotes entries that contain `:` or quotes:
  //   - 'button "Say: \"hi\"" [ref=e2]'
  //   - 'link "x: y" [ref=e3]':
  if (text.startsWith("'")) {
    let key = '';
    let i = 1;
    while (i < text.length) {
      if (text[i] === "'") {
        if (text[i + 1] === "'") {
          key += "'";
          i += 2;
          continue;
        }
        break;
      }
      key += text[i++];
    }
    text = key + text.slice(i + 1);
  }

  const head = /^([a-z][\w-]*)(?: "((?:[^"\\]|\\.)*)")?(.*)$/.exec(text);
  if (!head) return { indent, text, hasInlineText: false };
  const rest = head[3]!;
  const ref = /\[ref=((?:f\d+)?e\d+)\]/.exec(rest)?.[1];
  return {
    indent,
    text,
    role: head[1]!,
    ...(head[2] !== undefined ? { name: unescapeName(head[2]) } : {}),
    ...(ref ? { ref } : {}),
    hasInlineText: /^\s*:\s*\S/.test(rest.replace(/\[[^\]]*\]/g, '')),
  };
}

/**
 * Filter a Playwright AI snapshot (`page.ariaSnapshot({ mode: 'ai' })`) and
 * collect the refs it shows. Refs are kept exactly as Playwright assigned them,
 * so `aria-ref=<ref>` resolves them, including refs inside iframes (`f1e2`).
 */
export function processAiSnapshot(tree: string, options: SnapshotOptions = {}): EnhancedSnapshot {
  const refs: Record<string, SnapshotRef> = {};
  const addRef = (line: SnapshotLine) => {
    if (line.ref && line.role) {
      refs[line.ref] = { role: line.role, ...(line.name ? { name: line.name } : {}) };
    }
  };

  const lines = tree.split('\n').filter(line => line.trim() !== '');

  if (options.interactive) {
    const out: string[] = [];
    for (const raw of lines) {
      const line = parseSnapshotLine(raw);
      if (!line?.ref || !line.role || !INTERACTIVE_ROLES.has(line.role)) continue;
      addRef(line);
      out.push(`- ${line.text.replace(/:\s*$/, '')}`);
    }
    return { tree: out.join('\n') || '(no interactive elements)', refs };
  }

  const out: string[] = [];
  // Ancestors of the current line; dropped wrappers shift their children left.
  const stack: Array<{ indent: number; dropped: boolean }> = [];
  for (const raw of lines) {
    const indent = /^\s*/.exec(raw)![0].length;
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const shift = stack.filter(entry => entry.dropped).length * 2;
    const line = parseSnapshotLine(raw);

    const drop =
      !!options.compact &&
      !!line?.role &&
      STRUCTURAL_ROLES.has(line.role) &&
      !line.name &&
      !line.hasInlineText &&
      !raw.includes('[cursor=pointer]');
    stack.push({ indent, dropped: drop });
    if (drop) continue;

    if (line) addRef(line);
    out.push(raw.slice(Math.min(shift, indent)));
  }
  return { tree: out.join('\n'), refs };
}

/**
 * Browser session driven entirely by Playwright.
 *
 * Local launches start Chrome as a child of this Node process (Playwright's
 * Chromium, or an installed Google Chrome as a fallback), so the browser never
 * outlives the process. With `cdpUrl` the manager attaches to an existing
 * browser and `close()` only disconnects from it.
 *
 * Snapshots come from Playwright's AI aria snapshot; refs resolve through
 * Playwright's `aria-ref` selector, including elements inside iframes.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: BrowserContext[] = [];
  private pages: Page[] = [];
  private activePageIndex = 0;
  private cdpSession: CDPSession | null = null;
  private refMap: Record<string, SnapshotRef> = {};
  /** Page the current {@link refMap} was captured on. */
  private snapshotPage: Page | null = null;
  private ownsBrowser = false;
  private pendingLaunch: Promise<void> | null = null;

  isLaunched(): boolean {
    return this.browser !== null || this.contexts.length > 0;
  }

  /**
   * Launch Chrome, or connect to an existing browser when `cdpUrl` is set.
   * A failed launch or connect releases everything it acquired before rethrowing.
   */
  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    if (options.profile && options.cdpUrl) {
      throw new Error('Profile cannot be used with CDP connection');
    }
    if (options.storageState && options.profile) {
      throw new Error('Storage state cannot be used with profile (profile is already persistent storage)');
    }
    if (this.pendingLaunch) return this.pendingLaunch;
    if (this.isLaunched()) return;

    const launching = (async () => {
      try {
        if (options.cdpUrl) {
          await this.connect(options.cdpUrl, options.cdpHeaders);
        } else {
          await this.launchLocal(options);
        }
        await this.trackInitialPages();
      } catch (error) {
        await this.teardown().catch(() => {});
        throw error;
      }
    })();
    this.pendingLaunch = launching;
    try {
      await launching;
    } finally {
      if (this.pendingLaunch === launching) this.pendingLaunch = null;
    }
  }

  private async connect(cdpUrl: string, headers?: Record<string, string>): Promise<void> {
    const endpoint = normalizeCdpEndpoint(cdpUrl);
    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(endpoint, { headers, timeout: CONNECT_TIMEOUT_MS });
    } catch (error) {
      throw new Error(
        `Failed to connect via CDP to ${endpoint}. ` +
          (endpoint.includes('127.0.0.1')
            ? 'Make sure the browser is running with remote debugging enabled.'
            : 'Make sure the remote browser is accessible and the URL is correct.'),
        { cause: error },
      );
    }
    this.browser = browser;
    this.ownsBrowser = false;
    this.watchBrowser(browser);

    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser context found. Make sure the browser has an open window.');
    }
    for (const context of contexts) this.addContext(context);
  }

  private async launchLocal(options: BrowserLaunchOptions): Promise<void> {
    const launchOptions: LaunchOptions = {
      headless: options.headless ?? true,
      ...(options.args?.length ? { args: options.args } : {}),
      ...(options.executablePath ? { executablePath: options.executablePath } : {}),
      ...(options.channel && !options.executablePath ? { channel: options.channel } : {}),
      ...(options.proxy ? { proxy: { server: options.proxy } } : {}),
    };
    const contextOptions: BrowserContextOptions = {
      viewport: resolveViewport(options),
      ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? false,
      ...(options.userAgent ? { userAgent: options.userAgent } : {}),
    };

    this.ownsBrowser = true;
    if (options.profile) {
      const profileDir = expandHome(options.profile);
      const context = await launchWithChromeFallback(
        opts => chromium.launchPersistentContext(profileDir, { ...opts, ...contextOptions }),
        launchOptions,
      );
      this.addContext(context);
      this.browser = context.browser();
      if (this.browser) this.watchBrowser(this.browser);
      return;
    }

    const browser = await launchWithChromeFallback(opts => chromium.launch(opts), launchOptions);
    this.browser = browser;
    this.watchBrowser(browser);
    const context = await browser.newContext({
      ...contextOptions,
      ...(options.storageState ? { storageState: options.storageState } : {}),
    });
    this.addContext(context);
  }

  /** Forget a browser that went away on its own (crash, killed, remote closed). */
  private watchBrowser(browser: Browser): void {
    browser.on('disconnected', () => {
      if (this.browser !== browser) return;
      this.browser = null;
      this.contexts = [];
      this.cdpSession = null;
      this.ownsBrowser = false;
    });
  }

  private async trackInitialPages(): Promise<void> {
    // Pages with an empty URL can hang Playwright; skip them.
    for (const page of this.contexts.flatMap(c => c.pages()).filter(p => p.url())) {
      if (!this.pages.includes(page)) this.trackPage(page);
    }
    if (this.pages.length === 0) {
      const page = await this.contexts[0]!.newPage();
      if (!this.pages.includes(page)) this.trackPage(page);
    }
    this.activePageIndex = 0;
  }

  private addContext(context: BrowserContext): void {
    this.contexts.push(context);
    context.on('page', page => {
      if (!this.pages.includes(page)) this.trackPage(page);
      // Follow popups / target=_blank so later commands hit the new tab.
      const index = this.pages.indexOf(page);
      if (index !== -1 && index !== this.activePageIndex) {
        this.activePageIndex = index;
        void this.invalidateCDPSession();
      }
    });
    context.on('close', () => {
      const index = this.contexts.indexOf(context);
      if (index !== -1) this.contexts.splice(index, 1);
    });
  }

  private trackPage(page: Page): void {
    this.pages.push(page);
    page.on('close', () => this.untrackPage(page));
  }

  private untrackPage(page: Page): void {
    const index = this.pages.indexOf(page);
    if (index === -1) return;
    this.pages.splice(index, 1);
    if (this.activePageIndex >= this.pages.length) {
      this.activePageIndex = Math.max(0, this.pages.length - 1);
    } else if (this.activePageIndex > index) {
      this.activePageIndex--;
    }
  }

  getPage(): Page {
    if (this.pages.length === 0) {
      throw new Error('Browser not launched. Call launch first.');
    }
    return this.pages[this.activePageIndex] ?? this.pages[0]!;
  }

  getPages(): Page[] {
    return this.pages;
  }

  getActiveIndex(): number {
    return this.activePageIndex;
  }

  getContext(): BrowserContext | null {
    return this.contexts[0] ?? null;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  async newTab(): Promise<{ index: number; total: number }> {
    const context = this.getContext();
    if (!this.isLaunched() || !context) throw new Error('Browser not launched');
    await this.invalidateCDPSession();
    const page = await context.newPage();
    if (!this.pages.includes(page)) this.trackPage(page);
    this.activePageIndex = this.pages.indexOf(page);
    return { index: this.activePageIndex, total: this.pages.length };
  }

  async switchTo(index: number): Promise<{ index: number; url: string; title: string }> {
    if (index < 0 || index >= this.pages.length) {
      throw new Error(`Invalid tab index: ${index}. Available: 0-${this.pages.length - 1}`);
    }
    if (index !== this.activePageIndex) await this.invalidateCDPSession();
    this.activePageIndex = index;
    const page = this.pages[index]!;
    return { index, url: page.url(), title: await page.title().catch(() => '') };
  }

  async closeTab(index?: number): Promise<{ closed: number; remaining: number }> {
    const target = index ?? this.activePageIndex;
    if (target < 0 || target >= this.pages.length) {
      throw new Error(`Invalid tab index: ${target}`);
    }
    if (this.pages.length === 1) {
      throw new Error('Cannot close the last tab. Use "close" to close the browser.');
    }
    if (target === this.activePageIndex) await this.invalidateCDPSession();
    const page = this.pages[target]!;
    await page.close();
    // The page 'close' handler normally removes it; make sure it's gone.
    this.untrackPage(page);
    return { closed: target, remaining: this.pages.length };
  }

  async listTabs(): Promise<Array<{ index: number; url: string; title: string; active: boolean }>> {
    return Promise.all(
      this.pages.map(async (page, index) => ({
        index,
        url: page.url(),
        title: await page.title().catch(() => ''),
        active: index === this.activePageIndex,
      })),
    );
  }

  /**
   * Capture an accessibility snapshot of the active tab with element refs and
   * cache the refs for {@link getLocatorFromRef}.
   */
  async getSnapshot(options: SnapshotOptions = {}): Promise<EnhancedSnapshot> {
    const page = this.getPage();
    const tree = await page.ariaSnapshot({
      mode: 'ai',
      ...(options.depth !== undefined ? { depth: options.depth } : {}),
    });
    const snapshot = processAiSnapshot(tree, options);
    this.refMap = snapshot.refs;
    this.snapshotPage = page;
    return snapshot;
  }

  getRefMap(): Record<string, SnapshotRef> {
    return this.refMap;
  }

  /**
   * Resolve a ref (`e1`, `@e1`, `ref=e1`, `@f1e2`) from the last snapshot to a
   * locator. Returns null for refs the last snapshot didn't show, or when that
   * snapshot was taken on a different tab.
   */
  getLocatorFromRef(refArg: string): Locator | null {
    const ref = parseRef(refArg);
    if (!ref || !this.refMap[ref]) return null;
    const page = this.getPage();
    if (page !== this.snapshotPage) return null;
    return page.locator(`aria-ref=${ref}`);
  }

  async getCDPSession(): Promise<CDPSession> {
    if (this.cdpSession) return this.cdpSession;
    const page = this.getPage();
    this.cdpSession = await page.context().newCDPSession(page);
    return this.cdpSession;
  }

  async invalidateCDPSession(): Promise<void> {
    const session = this.cdpSession;
    this.cdpSession = null;
    if (session) await session.detach().catch(() => {});
  }

  async injectMouseEvent(params: MouseEventInput): Promise<void> {
    const cdp = await this.getCDPSession();
    const button = params.button && ['left', 'right', 'middle'].includes(params.button) ? params.button : 'none';
    await cdp.send('Input.dispatchMouseEvent', {
      type: params.type,
      x: params.x,
      y: params.y,
      button,
      clickCount: params.clickCount ?? 1,
      deltaX: params.deltaX ?? 0,
      deltaY: params.deltaY ?? 0,
      modifiers: params.modifiers ?? 0,
    });
  }

  /**
   * Close the session. A browser this manager launched is shut down; a browser
   * reached over `cdpUrl` is only disconnected and keeps running.
   * Waits for an in-flight {@link launch} so it can't leave a browser behind.
   */
  async close(): Promise<void> {
    if (this.pendingLaunch) await this.pendingLaunch.catch(() => {});
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    await this.invalidateCDPSession();
    const browser = this.browser;
    const contexts = this.contexts;
    const ownsBrowser = this.ownsBrowser;
    this.browser = null;
    this.contexts = [];
    this.pages = [];
    this.activePageIndex = 0;
    this.refMap = {};
    this.snapshotPage = null;
    this.ownsBrowser = false;

    if (ownsBrowser) {
      // Closing the contexts first flushes persistent profiles to disk.
      for (const context of contexts) await context.close().catch(() => {});
    }
    // Owned: terminates the Chrome child process. Over CDP: disconnects only.
    if (browser) await browser.close().catch(() => {});
  }
}

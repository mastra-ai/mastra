import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { accessSync, chmodSync, constants, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, platform } from 'node:os';
import { dirname, join } from 'node:path';

import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, CDPSession, Locator, Page } from 'playwright-core';

/**
 * Options for {@link BrowserManager.launch}.
 */
export interface BrowserLaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number } | null;
  /** Extra Chrome launch args. */
  args?: string[];
  /** Chrome profile name or directory (persistent user data). */
  profile?: string;
  executablePath?: string;
  /** Path to a Playwright-style storage state JSON file. */
  storageState?: string;
  /** Connect to an existing browser instead of launching one. */
  cdpUrl?: string;
  /** Headers sent with the CDP websocket handshake (e.g. Authorization). */
  cdpHeaders?: Record<string, string>;
  userAgent?: string;
  proxy?: string;
  ignoreHTTPSErrors?: boolean;
}

export interface SnapshotRef {
  role: string;
  name?: string;
  nth?: number;
}

export interface EnhancedSnapshot {
  tree: string;
  refs: Record<string, SnapshotRef>;
}

export interface SnapshotOptions {
  interactive?: boolean;
  compact?: boolean;
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

interface CliResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface CliTab {
  tabId: string;
  active: boolean;
  targetId: string;
  url: string;
}

const CLI_TIMEOUT_MS = 60_000;

function getRequire(): NodeRequire {
  // __filename exists in the CJS build; import.meta.url in the ESM build.
  return createRequire(typeof __filename === 'string' ? __filename : import.meta.url);
}

let cachedCli: { command: string; prefixArgs: string[] } | undefined;

/**
 * Locate the agent-browser CLI. Prefers the platform's native binary shipped in
 * the npm package and falls back to the package's node launcher.
 * `AGENT_BROWSER_CLI_PATH` overrides the lookup.
 */
export function resolveAgentBrowserCli(): { command: string; prefixArgs: string[] } {
  if (process.env.AGENT_BROWSER_CLI_PATH) {
    return { command: process.env.AGENT_BROWSER_CLI_PATH, prefixArgs: [] };
  }
  if (cachedCli) return cachedCli;

  const pkgDir = dirname(getRequire().resolve('agent-browser/package.json'));
  const binDir = join(pkgDir, 'bin');
  const os = platform();
  const cpu = arch() === 'arm64' ? 'arm64' : 'x64';
  const osKey = os === 'win32' ? 'win32' : os === 'darwin' ? 'darwin' : isMusl() ? 'linux-musl' : 'linux';
  const native = join(binDir, `agent-browser-${osKey}-${cpu}${os === 'win32' ? '.exe' : ''}`);

  if (existsSync(native)) {
    if (os !== 'win32') {
      try {
        accessSync(native, constants.X_OK);
      } catch {
        try {
          chmodSync(native, 0o755);
        } catch {
          // fall through to the node launcher below
        }
      }
    }
    try {
      if (os !== 'win32') accessSync(native, constants.X_OK);
      cachedCli = { command: native, prefixArgs: [] };
      return cachedCli;
    } catch {
      // not executable
    }
  }

  cachedCli = { command: process.execPath, prefixArgs: [join(binDir, 'agent-browser.js')] };
  return cachedCli;
}

function isMusl(): boolean {
  if (platform() !== 'linux') return false;
  try {
    const report = (process.report?.getReport?.() ?? {}) as { header?: { glibcVersionRuntime?: string } };
    return !report.header?.glibcVersionRuntime;
  } catch {
    return existsSync('/lib/ld-musl-x86_64.so.1') || existsSync('/lib/ld-musl-aarch64.so.1');
  }
}

function parseRef(arg: string): string | null {
  const ref = arg.trim().replace(/^@/, '').replace(/^ref=/, '');
  return /^e\d+$/.test(ref) ? ref : null;
}

function normalizeCdpEndpoint(endpoint: string): string {
  if (/^(wss?|https?):\/\//.test(endpoint)) return endpoint;
  return `http://127.0.0.1:${endpoint}`;
}

/**
 * Browser session backed by the agent-browser CLI.
 *
 * The CLI launches and owns Chrome (binary discovery, profiles, storage state)
 * and produces the ref-annotated accessibility snapshots. Playwright attaches to
 * the same browser over CDP for page-level work: navigation, locators,
 * screencast and input injection.
 */
export class BrowserManager {
  readonly session = `mastra-${process.pid}-${randomUUID().slice(0, 8)}`;

  private browser: Browser | null = null;
  private contexts: BrowserContext[] = [];
  private pages: Page[] = [];
  private activePageIndex = 0;
  private cdpSession: CDPSession | null = null;
  private refMap: Record<string, SnapshotRef> = {};
  /** 'role' refs come from the CLI snapshot; 'aria' refs from Playwright's AI snapshot. */
  private refMode: 'role' | 'aria' = 'role';
  private ownsBrowser = false;
  private cliAttached = false;
  private readonly targetIds = new WeakMap<Page, string>();

  /** Run an agent-browser CLI command for this session and return its `data`. */
  async cli<T = Record<string, unknown>>(args: string[], timeout = CLI_TIMEOUT_MS): Promise<T> {
    const { command, prefixArgs } = resolveAgentBrowserCli();
    const fullArgs = [...prefixArgs, '--session', this.session, '--json', ...args];
    const { stdout, stderr, error } = await new Promise<{ stdout: string; stderr: string; error: Error | null }>(
      resolve => {
        execFile(command, fullArgs, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, out, errOut) => {
          resolve({ stdout: String(out ?? ''), stderr: String(errOut ?? ''), error: err });
        });
      },
    );

    const line = stdout
      .trim()
      .split('\n')
      .reverse()
      .find(l => l.trim().startsWith('{'));
    let parsed: CliResponse<T> | undefined;
    if (line) {
      try {
        parsed = JSON.parse(line) as CliResponse<T>;
      } catch {
        parsed = undefined;
      }
    }
    if (!parsed) {
      const detail = (stderr || stdout || error?.message || 'no output').trim();
      throw new Error(`agent-browser ${args[0] ?? ''} failed: ${detail}`);
    }
    if (!parsed.success) {
      throw new Error(parsed.error ?? `agent-browser ${args[0] ?? ''} failed`);
    }
    return (parsed.data ?? {}) as T;
  }

  isLaunched(): boolean {
    return this.browser !== null;
  }

  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    if (options.profile && options.cdpUrl) {
      throw new Error('Profile cannot be used with CDP connection');
    }
    if (options.storageState && options.profile) {
      throw new Error('Storage state cannot be used with profile (profile is already persistent storage)');
    }
    if (this.isLaunched()) return;

    let browser: Browser;
    if (options.cdpUrl) {
      const endpoint = normalizeCdpEndpoint(options.cdpUrl);
      browser = await chromium
        .connectOverCDP(endpoint, { headers: options.cdpHeaders, timeout: CLI_TIMEOUT_MS })
        .catch(() => {
          throw new Error(
            `Failed to connect via CDP to ${endpoint}. ` +
              (endpoint.includes('127.0.0.1')
                ? 'Make sure the browser is running with remote debugging enabled.'
                : 'Make sure the remote browser is accessible and the URL is correct.'),
          );
        });
      this.ownsBrowser = false;
      // The CLI can't send custom handshake headers, so with cdpHeaders we
      // snapshot through Playwright instead.
      if (!options.cdpHeaders) {
        try {
          await this.cli(['connect', endpoint]);
          this.cliAttached = true;
        } catch {
          this.cliAttached = false;
        }
      }
    } else {
      await this.cli([...this.launchFlags(options), 'open', 'about:blank']);
      this.ownsBrowser = true;
      this.cliAttached = true;
      const { cdpUrl } = await this.cli<{ cdpUrl: string }>(['get', 'cdp-url']);
      browser = await chromium.connectOverCDP(cdpUrl, { timeout: CLI_TIMEOUT_MS });
    }

    try {
      const contexts = browser.contexts();
      if (contexts.length === 0) {
        throw new Error('No browser context found. Make sure the browser has an open window.');
      }
      this.browser = browser;
      for (const context of contexts) {
        this.contexts.push(context);
        this.trackContext(context);
      }
      // Pages with an empty URL can hang Playwright; skip them.
      for (const page of contexts.flatMap(c => c.pages()).filter(p => p.url())) {
        this.trackPage(page);
      }

      if (this.ownsBrowser) {
        await this.adoptCliTab();
        if (options.viewport) {
          await this.cli(['set', 'viewport', String(options.viewport.width), String(options.viewport.height)]);
        }
      }

      if (this.pages.length === 0) {
        const page = await this.contexts[0]!.newPage();
        this.trackPage(page);
        this.activePageIndex = 0;
      }
    } catch (error) {
      await this.close().catch(() => {});
      throw error;
    }
  }

  private launchFlags(options: BrowserLaunchOptions): string[] {
    const flags: string[] = [];
    if (options.headless === false) flags.push('--headed');
    if (options.executablePath) flags.push('--executable-path', options.executablePath);
    if (options.profile) flags.push('--profile', options.profile);
    if (options.storageState) flags.push('--state', options.storageState);
    if (options.args?.length) flags.push('--args', options.args.join(','));
    if (options.userAgent) flags.push('--user-agent', options.userAgent);
    if (options.proxy) flags.push('--proxy', options.proxy);
    if (options.ignoreHTTPSErrors) flags.push('--ignore-https-errors');
    return flags;
  }

  /** Make the CLI's active tab ours and drop Chrome's stray new-tab page. */
  private async adoptCliTab(): Promise<void> {
    const { tabs } = await this.cli<{ tabs: CliTab[] }>(['tab', 'list']);
    const active = tabs.find(t => t.active);
    if (!active) return;
    let activePage: Page | undefined;
    for (const page of this.pages) {
      if ((await this.getTargetId(page)) === active.targetId) activePage = page;
    }
    if (!activePage) return;
    for (const page of [...this.pages]) {
      if (page !== activePage && page.url().startsWith('chrome://new-tab-page')) {
        await page.close().catch(() => {});
      }
    }
    this.activePageIndex = Math.max(0, this.pages.indexOf(activePage));
  }

  private trackContext(context: BrowserContext): void {
    context.on('page', page => {
      if (!this.pages.includes(page)) this.trackPage(page);
      // Follow popups / target=_blank so later commands hit the new tab.
      const index = this.pages.indexOf(page);
      if (index !== -1 && index !== this.activePageIndex) {
        this.activePageIndex = index;
        void this.invalidateCDPSession();
      }
    });
  }

  private trackPage(page: Page): void {
    this.pages.push(page);
    page.on('close', () => {
      const index = this.pages.indexOf(page);
      if (index === -1) return;
      this.pages.splice(index, 1);
      if (this.activePageIndex >= this.pages.length) {
        this.activePageIndex = Math.max(0, this.pages.length - 1);
      } else if (this.activePageIndex > index) {
        this.activePageIndex--;
      }
    });
  }

  private async getTargetId(page: Page): Promise<string | undefined> {
    const cached = this.targetIds.get(page);
    if (cached) return cached;
    try {
      const session = await page.context().newCDPSession(page);
      try {
        const { targetInfo } = (await session.send('Target.getTargetInfo')) as { targetInfo: { targetId: string } };
        this.targetIds.set(page, targetInfo.targetId);
        return targetInfo.targetId;
      } finally {
        await session.detach().catch(() => {});
      }
    } catch {
      return undefined;
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
    return { index, url: this.pages[index]!.url(), title: '' };
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
    const stillThere = this.pages.indexOf(page);
    if (stillThere !== -1) {
      this.pages.splice(stillThere, 1);
      if (this.activePageIndex >= this.pages.length) this.activePageIndex = this.pages.length - 1;
      else if (this.activePageIndex > stillThere) this.activePageIndex--;
    }
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
   * Capture an accessibility snapshot with element refs and cache the ref map
   * for {@link getLocatorFromRef}.
   */
  async getSnapshot(options: SnapshotOptions = {}): Promise<EnhancedSnapshot> {
    const page = this.getPage();
    if (this.cliAttached && (await this.focusCliOn(page))) {
      const args = ['snapshot'];
      if (options.interactive) args.push('-i');
      if (options.compact) args.push('-c');
      if (options.depth !== undefined) args.push('-d', String(options.depth));
      const data = await this.cli<{ snapshot?: string; refs?: Record<string, SnapshotRef> }>(args);
      this.refMap = withNth(data.refs ?? {});
      this.refMode = 'role';
      return { tree: data.snapshot ?? '', refs: this.refMap };
    }

    const tree = await page.ariaSnapshot({ mode: 'ai', depth: options.depth });
    const refs: Record<string, SnapshotRef> = {};
    for (const match of tree.matchAll(/- ([a-z]+)(?: "([^"]*)")?[^\n]*\[ref=(e\d+)\]/g)) {
      refs[match[3]!] = { role: match[1]!, ...(match[2] ? { name: match[2] } : {}) };
    }
    this.refMap = refs;
    this.refMode = 'aria';
    return { tree, refs };
  }

  /** Point the CLI at the same tab Playwright considers active. */
  private async focusCliOn(page: Page): Promise<boolean> {
    try {
      const targetId = await this.getTargetId(page);
      if (!targetId) return false;
      const { tabs } = await this.cli<{ tabs: CliTab[] }>(['tab', 'list']);
      const tab = tabs.find(t => t.targetId === targetId);
      if (!tab) return false;
      if (!tab.active) await this.cli(['tab', tab.tabId]);
      return true;
    } catch {
      return false;
    }
  }

  getRefMap(): Record<string, SnapshotRef> {
    return this.refMap;
  }

  /** Resolve a ref (`e1`, `@e1`, `ref=e1`) from the last snapshot to a locator. */
  getLocatorFromRef(refArg: string): Locator | null {
    const ref = parseRef(refArg);
    if (!ref) return null;
    const data = this.refMap[ref];
    if (!data) return null;
    const page = this.getPage();
    if (this.refMode === 'aria') {
      return page.locator(`aria-ref=${ref}`);
    }
    let locator = page.getByRole(data.role as Parameters<Page['getByRole']>[0], {
      ...(data.name ? { name: data.name } : {}),
      exact: true,
    });
    if (data.nth !== undefined) locator = locator.nth(data.nth);
    return locator;
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

  async close(): Promise<void> {
    await this.invalidateCDPSession();
    const browser = this.browser;
    this.browser = null;
    this.contexts = [];
    this.pages = [];
    this.activePageIndex = 0;
    this.refMap = {};
    // Over CDP this only disconnects Playwright; the CLI owns the process.
    if (browser) await browser.close().catch(() => {});
    if (this.ownsBrowser || this.cliAttached) {
      // For an attached (not owned) browser this just ends the CLI session.
      await this.cli(['close']).catch(() => {});
    }
    this.ownsBrowser = false;
    this.cliAttached = false;
  }
}

/** Add `nth` to refs that share a role+name so locators can disambiguate. */
function withNth(refs: Record<string, SnapshotRef>): Record<string, SnapshotRef> {
  const ordered = Object.entries(refs).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
  const counts = new Map<string, number>();
  for (const [, ref] of ordered) {
    const key = `${ref.role}\u0000${ref.name ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const out: Record<string, SnapshotRef> = {};
  for (const [id, ref] of ordered) {
    const key = `${ref.role}\u0000${ref.name ?? ''}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    out[id] =
      ref.nth !== undefined || (counts.get(key) ?? 0) < 2
        ? {
            role: ref.role,
            ...(ref.name ? { name: ref.name } : {}),
            ...(ref.nth !== undefined ? { nth: ref.nth } : {}),
          }
        : { role: ref.role, ...(ref.name ? { name: ref.name } : {}), nth: index };
  }
  return out;
}

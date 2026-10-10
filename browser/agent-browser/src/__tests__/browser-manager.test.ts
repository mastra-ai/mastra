/**
 * Unit tests for BrowserManager with Playwright mocked out (no Chrome needed).
 */
import { EventEmitter } from 'node:events';
import { homedir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chromium = vi.hoisted(() => ({
  launch: vi.fn(),
  launchPersistentContext: vi.fn(),
  connectOverCDP: vi.fn(),
}));

vi.mock('playwright-core', () => ({ chromium }));

import { BrowserManager, CHROME_NOT_FOUND_MESSAGE, parseRef, processAiSnapshot } from '../browser-manager';

class FakePage extends EventEmitter {
  closed = false;
  ariaSnapshot = vi.fn(async (_options?: unknown) => '');
  locator = vi.fn((selector: string) => ({ selector }));
  title = vi.fn(async () => `title of ${this.pageUrl}`);
  close = vi.fn(async () => {
    if (this.closed) return;
    this.closed = true;
    this.emit('close', this);
  });

  constructor(
    private readonly ctx: FakeContext,
    private pageUrl = 'about:blank',
  ) {
    super();
  }

  url() {
    return this.pageUrl;
  }

  context() {
    return this.ctx;
  }
}

class FakeContext extends EventEmitter {
  readonly pageList: FakePage[] = [];
  browserRef: FakeBrowser | null = null;
  newPage = vi.fn(async () => this.openPage());
  close = vi.fn(async () => {
    for (const page of [...this.pageList]) await page.close();
    this.emit('close', this);
  });
  newCDPSession = vi.fn(async () => ({ send: vi.fn(async () => ({})), detach: vi.fn(async () => {}) }));

  /** Simulates a page opening (newPage, popup, target=_blank). */
  openPage(url = 'about:blank') {
    const page = new FakePage(this, url);
    this.pageList.push(page);
    page.on('close', () => this.pageList.splice(this.pageList.indexOf(page), 1));
    this.emit('page', page);
    return page;
  }

  pages() {
    return this.pageList;
  }

  browser() {
    return this.browserRef;
  }
}

class FakeBrowser extends EventEmitter {
  readonly contextList: FakeContext[] = [];
  connected = true;
  newContext = vi.fn(async (_options?: unknown) => this.addContext());
  close = vi.fn(async () => {
    if (!this.connected) return;
    this.connected = false;
    this.emit('disconnected', this);
  });

  addContext() {
    const context = new FakeContext();
    context.browserRef = this;
    this.contextList.push(context);
    return context;
  }

  contexts() {
    return this.contextList;
  }

  isConnected() {
    return this.connected;
  }
}

function missingExecutable(): Error {
  return new Error("browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium/chrome");
}

let browser: FakeBrowser;

beforeEach(() => {
  vi.clearAllMocks();
  browser = new FakeBrowser();
  chromium.launch.mockImplementation(async () => browser);
  chromium.connectOverCDP.mockImplementation(async () => browser);
  chromium.launchPersistentContext.mockImplementation(async () => {
    const context = browser.addContext();
    context.openPage();
    return context;
  });
});

afterEach(() => {
  delete process.env.AGENT_BROWSER_HEADED;
});

describe('parseRef', () => {
  it.each([
    ['e1', 'e1'],
    ['@e12', 'e12'],
    ['ref=e3', 'e3'],
    [' @e4 ', 'e4'],
    ['@f1e2', 'f1e2'],
    ['f12e7', 'f12e7'],
  ])('accepts %s', (input, expected) => {
    expect(parseRef(input)).toBe(expected);
  });

  it.each(['button', 'e', 'f1', '@', '#submit', 'e1e2', 'fe1', '@e1 extra'])('rejects %s', input => {
    expect(parseRef(input)).toBeNull();
  });
});

const AI_TREE = [
  '- generic [active] [ref=e1]:',
  '  - heading "Title" [level=1] [ref=e2]',
  `  - 'button "Say: \\"hi\\"" [ref=e3]'`,
  `  - 'link "x: y" [ref=e4] [cursor=pointer]':`,
  '    - /url: "#"',
  '  - group [ref=e5]:',
  '    - text: plain text',
  '    - textbox "Email" [ref=e6]: v',
  '  - generic [ref=e7] [cursor=pointer]: Clickable div',
  '  - iframe [ref=e8]:',
  '    - generic [active] [ref=f1e1]:',
  '      - button "Inner" [ref=f1e2]',
].join('\n');

describe('processAiSnapshot', () => {
  it('lists only interactive elements, flattened, including iframe contents', () => {
    const { tree, refs } = processAiSnapshot(AI_TREE, { interactive: true });
    expect(tree).toBe(
      [
        '- button "Say: \\"hi\\"" [ref=e3]',
        '- link "x: y" [ref=e4] [cursor=pointer]',
        '- textbox "Email" [ref=e6]: v',
        '- button "Inner" [ref=f1e2]',
      ].join('\n'),
    );
    expect(refs).toEqual({
      e3: { role: 'button', name: 'Say: "hi"' },
      e4: { role: 'link', name: 'x: y' },
      e6: { role: 'textbox', name: 'Email' },
      f1e2: { role: 'button', name: 'Inner' },
    });
  });

  it('reports when nothing is interactive', () => {
    expect(processAiSnapshot('- generic [ref=e1]:\n  - text: hi', { interactive: true })).toEqual({
      tree: '(no interactive elements)',
      refs: {},
    });
  });

  it('keeps the full tree and every ref without filters', () => {
    const { tree, refs } = processAiSnapshot(AI_TREE);
    expect(tree).toBe(AI_TREE);
    expect(Object.keys(refs)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'f1e1', 'f1e2']);
  });

  it('drops unnamed structural wrappers in compact mode and dedents their children', () => {
    const { tree, refs } = processAiSnapshot(AI_TREE, { compact: true });
    expect(tree).toBe(
      [
        '- heading "Title" [level=1] [ref=e2]',
        `- 'button "Say: \\"hi\\"" [ref=e3]'`,
        `- 'link "x: y" [ref=e4] [cursor=pointer]':`,
        '  - /url: "#"',
        '- text: plain text',
        '- textbox "Email" [ref=e6]: v',
        '- generic [ref=e7] [cursor=pointer]: Clickable div',
        '- iframe [ref=e8]:',
        '  - button "Inner" [ref=f1e2]',
      ].join('\n'),
    );
    // Hidden wrappers are not addressable
    expect(refs.e1).toBeUndefined();
    expect(refs.e5).toBeUndefined();
    expect(refs.f1e1).toBeUndefined();
    expect(refs.e7).toEqual({ role: 'generic' });
    expect(refs.f1e2).toEqual({ role: 'button', name: 'Inner' });
  });
});

describe('BrowserManager.launch (local)', () => {
  it('launches headless Chrome with a fresh context and one page', async () => {
    const manager = new BrowserManager();
    await manager.launch();

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
    expect(browser.newContext).toHaveBeenCalledWith({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: false,
    });
    expect(manager.isLaunched()).toBe(true);
    expect(manager.getPages()).toHaveLength(1);
    expect(manager.getBrowser()).toBe(browser);
    expect(manager.getContext()).toBe(browser.contextList[0]);
  });

  it('passes every option explicitly and ignores AGENT_BROWSER_* env', async () => {
    process.env.AGENT_BROWSER_HEADED = '1';
    const manager = new BrowserManager();
    await manager.launch({
      args: ['--disable-features=A,B'],
      executablePath: '/opt/chrome',
      channel: 'chrome-beta',
      proxy: 'http://proxy:8080',
      userAgent: 'UA',
      ignoreHTTPSErrors: true,
      storageState: '/tmp/state.json',
      viewport: { width: 800, height: 600 },
    });

    expect(chromium.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--disable-features=A,B'],
      executablePath: '/opt/chrome',
      proxy: { server: 'http://proxy:8080' },
    });
    expect(browser.newContext).toHaveBeenCalledWith({
      viewport: { width: 800, height: 600 },
      ignoreHTTPSErrors: true,
      userAgent: 'UA',
      storageState: '/tmp/state.json',
    });
  });

  it('uses the channel when no executablePath is set and honors headless: false', async () => {
    await new BrowserManager().launch({ channel: 'chrome', headless: false });
    expect(chromium.launch).toHaveBeenCalledWith({ headless: false, channel: 'chrome' });
  });

  it('disables viewport emulation when args size the window', async () => {
    await new BrowserManager().launch({ args: ['--start-maximized'] });
    expect(browser.newContext).toHaveBeenCalledWith(expect.objectContaining({ viewport: null }));
  });

  it('falls back to installed Chrome when Playwright Chromium is missing', async () => {
    chromium.launch.mockRejectedValueOnce(missingExecutable());
    const manager = new BrowserManager();
    await manager.launch();
    expect(chromium.launch).toHaveBeenCalledTimes(2);
    expect(chromium.launch).toHaveBeenLastCalledWith({ headless: true, channel: 'chrome' });
    expect(manager.isLaunched()).toBe(true);
  });

  it('explains how to install Chrome when no executable exists', async () => {
    chromium.launch
      .mockRejectedValueOnce(missingExecutable())
      .mockRejectedValueOnce(new Error("Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome"));
    const manager = new BrowserManager();
    await expect(manager.launch()).rejects.toThrow(CHROME_NOT_FOUND_MESSAGE);
    expect(manager.isLaunched()).toBe(false);
  });

  it('does not retry other launch errors or an explicit executablePath', async () => {
    chromium.launch.mockRejectedValueOnce(new Error('spawn EACCES'));
    await expect(new BrowserManager().launch()).rejects.toThrow('spawn EACCES');
    chromium.launch.mockRejectedValueOnce(missingExecutable());
    await expect(new BrowserManager().launch({ executablePath: '/nope' })).rejects.toThrow("Executable doesn't exist");
    expect(chromium.launch).toHaveBeenCalledTimes(2);
  });

  it('uses a persistent context for profiles and expands ~', async () => {
    const manager = new BrowserManager();
    await manager.launch({ profile: '~/my-profile', headless: false });
    expect(chromium.launchPersistentContext).toHaveBeenCalledWith(`${homedir()}/my-profile`, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: false,
    });
    expect(chromium.launch).not.toHaveBeenCalled();
    expect(manager.getPages()).toHaveLength(1);
    expect(manager.getBrowser()).toBe(browser);
  });

  it('rejects incompatible options before launching', async () => {
    const manager = new BrowserManager();
    await expect(manager.launch({ profile: '/p', cdpUrl: '9222' })).rejects.toThrow(/Profile cannot be used/);
    await expect(manager.launch({ profile: '/p', storageState: '/s.json' })).rejects.toThrow(/Storage state/);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it('launches once for concurrent calls and is a no-op when launched', async () => {
    const manager = new BrowserManager();
    await Promise.all([manager.launch(), manager.launch()]);
    await manager.launch();
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('closes the browser when context setup fails', async () => {
    browser.newContext.mockRejectedValueOnce(new Error('bad storage state'));
    const manager = new BrowserManager();
    await expect(manager.launch({ storageState: '/bad.json' })).rejects.toThrow('bad storage state');
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
  });

  it('closes the browser when opening the first page fails', async () => {
    browser.newContext.mockImplementationOnce(async () => {
      const context = browser.addContext();
      context.newPage.mockRejectedValueOnce(new Error('page crashed'));
      return context;
    });
    const manager = new BrowserManager();
    await expect(manager.launch()).rejects.toThrow('page crashed');
    expect(browser.contextList[0]!.close).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
  });
});

describe('BrowserManager.launch (cdpUrl)', () => {
  it('connects with headers and adopts existing pages', async () => {
    const context = browser.addContext();
    context.openPage('https://example.com');
    context.openPage('');
    const manager = new BrowserManager();
    await manager.launch({ cdpUrl: '9222', cdpHeaders: { Authorization: 'Bearer x' } });

    expect(chromium.connectOverCDP).toHaveBeenCalledWith('http://127.0.0.1:9222', {
      headers: { Authorization: 'Bearer x' },
      timeout: 60_000,
    });
    expect(chromium.launch).not.toHaveBeenCalled();
    // The empty-URL page is skipped
    expect(manager.getPages().map(p => p.url())).toEqual(['https://example.com']);
  });

  it('passes ws:// and https:// endpoints through unchanged', async () => {
    browser.addContext().openPage('https://a.test');
    await new BrowserManager().launch({ cdpUrl: 'wss://remote.example/devtools' });
    expect(chromium.connectOverCDP).toHaveBeenCalledWith('wss://remote.example/devtools', expect.anything());
  });

  it('wraps connection failures', async () => {
    chromium.connectOverCDP.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const manager = new BrowserManager();
    const error = await manager.launch({ cdpUrl: 'https://remote.example' }).catch(e => e);
    expect(error.message).toMatch(/Failed to connect via CDP to https:\/\/remote.example/);
    expect(error.cause.message).toBe('ECONNREFUSED');
    expect(manager.isLaunched()).toBe(false);
  });

  it('disconnects (without closing remote pages) when the browser has no context', async () => {
    const manager = new BrowserManager();
    await expect(manager.launch({ cdpUrl: '9222' })).rejects.toThrow(/No browser context found/);
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
  });
});

describe('BrowserManager.close', () => {
  it('shuts down a browser it launched', async () => {
    const manager = new BrowserManager();
    await manager.launch();
    const context = browser.contextList[0]!;
    await manager.close();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
    expect(manager.getPages()).toEqual([]);
    expect(() => manager.getPage()).toThrow(/Browser not launched/);
  });

  it('only disconnects from a cdpUrl browser', async () => {
    const context = browser.addContext();
    const remotePage = context.openPage('https://example.com');
    const manager = new BrowserManager();
    await manager.launch({ cdpUrl: 'ws://127.0.0.1:9222/devtools/browser/x' });
    await manager.close();

    expect(context.close).not.toHaveBeenCalled();
    expect(remotePage.close).not.toHaveBeenCalled();
    // Over CDP Browser.close() disconnects Playwright and leaves the browser running.
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
  });

  it('waits for an in-flight launch, then shuts it down', async () => {
    let finishLaunch!: () => void;
    chromium.launch.mockImplementationOnce(() => new Promise(resolve => (finishLaunch = () => resolve(browser))));
    const manager = new BrowserManager();
    const launching = manager.launch();
    const closing = manager.close();
    finishLaunch();
    await launching;
    await closing;

    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(manager.isLaunched()).toBe(false);
  });

  it('forgets a browser that disconnects on its own', async () => {
    const manager = new BrowserManager();
    await manager.launch();
    browser.emit('disconnected', browser);
    expect(manager.isLaunched()).toBe(false);
    expect(manager.getBrowser()).toBeNull();
    // A later launch starts a new browser
    browser = new FakeBrowser();
    await manager.launch();
    expect(manager.getBrowser()).toBe(browser);
  });
});

describe('BrowserManager tabs', () => {
  async function launched() {
    const manager = new BrowserManager();
    await manager.launch();
    return { manager, context: browser.contextList[0]! };
  }

  it('opens, switches and closes tabs', async () => {
    const { manager } = await launched();
    expect(await manager.newTab()).toEqual({ index: 1, total: 2 });
    expect(manager.getActiveIndex()).toBe(1);

    const switched = await manager.switchTo(0);
    expect(switched).toEqual({ index: 0, url: 'about:blank', title: 'title of about:blank' });
    expect(manager.getActiveIndex()).toBe(0);

    expect(await manager.closeTab(1)).toEqual({ closed: 1, remaining: 1 });
    await expect(manager.closeTab()).rejects.toThrow(/Cannot close the last tab/);
    await expect(manager.switchTo(3)).rejects.toThrow(/Invalid tab index: 3/);
    await expect(manager.closeTab(-1)).rejects.toThrow(/Invalid tab index/);
  });

  it('follows popups and keeps the active index right when tabs close', async () => {
    const { manager, context } = await launched();
    const popup = context.openPage('https://popup.test');
    expect(manager.getPage()).toBe(popup);
    expect(manager.getActiveIndex()).toBe(1);

    const third = context.openPage('https://third.test');
    expect(manager.getActiveIndex()).toBe(2);
    await manager.switchTo(2);

    // Closing a tab before the active one shifts the index down
    await (manager.getPages()[0] as unknown as FakePage).close();
    expect(manager.getActiveIndex()).toBe(1);
    expect(manager.getPage()).toBe(third);

    // Closing the active (last) tab moves to the previous one
    await third.close();
    expect(manager.getPage()).toBe(popup);
  });

  it('lists tabs with titles and the active marker', async () => {
    const { manager, context } = await launched();
    context.openPage('https://b.test');
    expect(await manager.listTabs()).toEqual([
      { index: 0, url: 'about:blank', title: 'title of about:blank', active: false },
      { index: 1, url: 'https://b.test', title: 'title of https://b.test', active: true },
    ]);
  });
});

describe('BrowserManager refs', () => {
  async function snapshotted(options = {}) {
    const manager = new BrowserManager();
    await manager.launch();
    const page = manager.getPage() as unknown as FakePage;
    page.ariaSnapshot.mockResolvedValue(AI_TREE);
    const snapshot = await manager.getSnapshot(options);
    return { manager, page, snapshot };
  }

  it('takes an AI aria snapshot of the active tab', async () => {
    const { page } = await snapshotted({ interactive: true, depth: 4 });
    expect(page.ariaSnapshot).toHaveBeenCalledWith({ mode: 'ai', depth: 4 });
  });

  it('resolves shown refs, including iframe refs, through aria-ref', async () => {
    const { manager, page } = await snapshotted({ interactive: true });
    for (const ref of ['e3', '@e3', 'ref=e3', '@f1e2']) {
      expect(manager.getLocatorFromRef(ref)).toEqual({ selector: `aria-ref=${parseRef(ref)}` });
    }
    expect(page.locator).toHaveBeenCalledWith('aria-ref=f1e2');
  });

  it('returns null for refs the snapshot did not show or that are malformed', async () => {
    const { manager } = await snapshotted({ interactive: true });
    expect(manager.getLocatorFromRef('@e1')).toBeNull(); // filtered out (not interactive)
    expect(manager.getLocatorFromRef('@f1e1')).toBeNull();
    expect(manager.getLocatorFromRef('@e99')).toBeNull();
    expect(manager.getLocatorFromRef('#submit')).toBeNull();
  });

  it('treats refs as stale after switching to another tab', async () => {
    const { manager } = await snapshotted({ interactive: true });
    await manager.newTab();
    expect(manager.getLocatorFromRef('@e3')).toBeNull();
    await manager.switchTo(0);
    expect(manager.getLocatorFromRef('@e3')).not.toBeNull();
  });

  it('clears refs on close', async () => {
    const { manager } = await snapshotted();
    await manager.close();
    expect(manager.getRefMap()).toEqual({});
  });
});

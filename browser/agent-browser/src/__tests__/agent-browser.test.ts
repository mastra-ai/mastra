import type { BrowserConfig } from '@mastra/core/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mocks BEFORE vi.mock using vi.hoisted so they're available in the mock
const { mockPage, mockLocator, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example'),
    goto: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    close: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    evaluate: vi.fn(),
    viewportSize: () => ({ width: 1280, height: 720 }),
    content: vi.fn().mockResolvedValue('<html></html>'),
    waitForTimeout: vi.fn(),
    keyboard: {
      press: vi.fn(),
      type: vi.fn(),
      down: vi.fn(),
      up: vi.fn(),
    },
    mouse: {
      click: vi.fn(),
      dblclick: vi.fn(),
      move: vi.fn(),
    },
    locator: vi.fn().mockReturnValue({
      click: vi.fn(),
      fill: vi.fn(),
      selectOption: vi.fn(),
      check: vi.fn(),
      uncheck: vi.fn(),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue('text'),
      inputValue: vi.fn().mockResolvedValue('value'),
    }),
    frames: vi.fn().mockReturnValue([]),
    context: vi.fn().mockReturnValue({
      pages: vi.fn().mockReturnValue([]),
      newPage: vi.fn(),
      cookies: vi.fn().mockResolvedValue([]),
      addCookies: vi.fn(),
      clearCookies: vi.fn(),
      storageState: vi.fn().mockResolvedValue({}),
      newCDPSession: vi.fn().mockResolvedValue({
        send: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }),
    }),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
  };

  const mockLocator = {
    click: vi.fn(),
    dblclick: vi.fn(),
    fill: vi.fn(),
    focus: vi.fn(),
    hover: vi.fn(),
    press: vi.fn(),
    selectOption: vi.fn().mockResolvedValue(['value1']),
    check: vi.fn(),
    uncheck: vi.fn(),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    textContent: vi.fn().mockResolvedValue('text'),
    inputValue: vi.fn().mockResolvedValue('value'),
    scrollIntoViewIfNeeded: vi.fn(),
    setInputFiles: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    dragTo: vi.fn(),
    waitFor: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
    getRefMap: vi.fn().mockResolvedValue(
      new Map([
        ['@e1', mockLocator],
        ['@e2', mockLocator],
      ]),
    ),
    getCDPSession: vi.fn().mockResolvedValue({
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    }),
    getSnapshot: vi.fn().mockResolvedValue({ snapshot: '- @e1 button "Click"', tree: '- @e1 button "Click"' }),
    startScreencast: vi.fn().mockResolvedValue(undefined),
    stopScreencast: vi.fn().mockResolvedValue(undefined),
    injectMouseEvent: vi.fn().mockResolvedValue(undefined),
    injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
  };

  return { mockPage, mockLocator, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    getLocatorFromRef = mockManager.getLocatorFromRef;
    getRefMap = mockManager.getRefMap;
    getCDPSession = mockManager.getCDPSession;
    getSnapshot = mockManager.getSnapshot;
    startScreencast = mockManager.startScreencast;
    stopScreencast = mockManager.stopScreencast;
    injectMouseEvent = mockManager.injectMouseEvent;
    injectKeyboardEvent = mockManager.injectKeyboardEvent;
    newTab = vi.fn().mockResolvedValue({ index: 0, total: 1 });
    newWindow = vi.fn().mockResolvedValue({ index: 0, total: 1 });
    switchTo = vi.fn().mockResolvedValue({ index: 0, url: 'https://example.com', title: 'Example' });
    closeTab = vi.fn().mockResolvedValue({ closed: 1, remaining: 0 });
    listTabs = vi.fn().mockResolvedValue([{ index: 0, url: 'https://example.com', title: 'Example', active: true }]);
    getContext = vi.fn().mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      pages: vi.fn().mockReturnValue([mockPage]),
    });
    getPages = vi.fn().mockReturnValue([mockPage]);
  },
}));

// Import AFTER vi.mock
import { AgentBrowser } from '../agent-browser';

describe('AgentBrowser', () => {
  let browser: AgentBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use 'shared' scope to get simpler shared browser behavior for unit tests
    browser = new AgentBrowser({ scope: 'shared' });
  });

  afterEach(async () => {
    await browser.close();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets id starting with agent-browser', () => {
      expect(browser.id).toMatch(/^agent-browser-/);
    });

    it('sets name to AgentBrowser', () => {
      expect(browser.name).toBe('AgentBrowser');
    });

    it('sets provider to vercel-labs/agent-browser', () => {
      expect(browser.provider).toBe('vercel-labs/agent-browser');
    });

    it('starts in pending status', () => {
      expect(browser.status).toBe('pending');
    });

    it('defaults headless to true', () => {
      expect(browser.headless).toBe(true);
    });

    it('respects headless: false', () => {
      const visible = new AgentBrowser({ headless: false });
      expect(visible.headless).toBe(false);
    });

    it('accepts custom config', () => {
      const custom = new AgentBrowser({ headless: false, timeout: 5000 });
      expect(custom.status).toBe('pending');
    });

    it('throws error when cdpUrl and scope: "thread" are both provided', () => {
      // cdpUrl and scope: 'thread' are mutually exclusive
      // TypeScript prevents this at compile time, but we test runtime validation
      expect(() => {
        new AgentBrowser({
          cdpUrl: 'ws://localhost:9222',
          scope: 'thread',
        } as BrowserConfig);
      }).toThrow('Invalid browser configuration: "cdpUrl" and "scope: \'thread\'" cannot be used together');
    });

    it('allows cdpUrl with scope: "shared"', () => {
      // This should not throw
      const browserWithCdp = new AgentBrowser({
        cdpUrl: 'ws://localhost:9222',
        scope: 'shared',
      });

      expect(browserWithCdp['threadManager'].getScope()).toBe('shared');
    });

    it('respects scope when no cdpUrl is provided', () => {
      const browserWithIsolation = new AgentBrowser({
        scope: 'thread',
      });

      expect(browserWithIsolation['threadManager'].getScope()).toBe('thread');
    });

    it('defaults to shared scope when cdpUrl is provided without explicit scope', () => {
      // When cdpUrl is provided without scope, it should default to 'shared'
      // since cdpUrl connects to an existing browser that can't be isolated
      const browserWithCdp = new AgentBrowser({
        cdpUrl: 'ws://localhost:9222',
      });

      expect(browserWithCdp['threadManager'].getScope()).toBe('shared');
    });
  });

  describe('status lifecycle', () => {
    it('starts in pending state', () => {
      expect(browser.status).toBe('pending');
    });

    it('transitions to ready after ensureReady', async () => {
      await browser.ensureReady();
      expect(browser.status).toBe('ready');
    });

    it('transitions to closed after close', async () => {
      await browser.ensureReady();
      await browser.close();
      expect(browser.status).toBe('closed');
    });
  });

  describe('ensureReady', () => {
    it('launches browser if not running', async () => {
      expect(browser.status).toBe('pending');
      await browser.ensureReady();
      expect(browser.status).toBe('ready');
      expect(mockManager.launch).toHaveBeenCalledOnce();
    });

    it('does not relaunch if already ready', async () => {
      await browser.ensureReady();
      await browser.ensureReady();
      expect(mockManager.launch).toHaveBeenCalledOnce();
    });

    it('detects externally closed browser and re-launches', async () => {
      await browser.ensureReady();
      expect(browser.status).toBe('ready');
      expect(mockManager.launch).toHaveBeenCalledOnce();

      // Simulate browser being externally closed
      mockPage.url.mockImplementationOnce(() => {
        throw new Error('Target page, context or browser has been closed');
      });

      // ensureReady should detect disconnection and re-launch
      await browser.ensureReady();
      expect(browser.status).toBe('ready');
      expect(mockManager.launch).toHaveBeenCalledTimes(2);
    });

    it('handles "Target closed" error during status check', async () => {
      await browser.ensureReady();

      // Simulate disconnect error
      mockPage.url.mockImplementationOnce(() => {
        throw new Error('Target closed');
      });

      await browser.ensureReady();
      // Should have re-launched
      expect(mockManager.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe('isBrowserRunning', () => {
    it('returns false before any operations', () => {
      expect(browser.isBrowserRunning()).toBe(false);
    });

    it('returns true after browser is launched', async () => {
      await browser.ensureReady();
      expect(browser.isBrowserRunning()).toBe(true);
    });
  });

  describe('close', () => {
    it('is a no-op when browser has not been launched', async () => {
      await browser.close();
      expect(mockManager.close).not.toHaveBeenCalled();
    });

    it('closes the browser and updates status', async () => {
      await browser.ensureReady();
      expect(browser.status).toBe('ready');

      await browser.close();
      expect(mockManager.close).toHaveBeenCalledOnce();
      expect(browser.status).toBe('closed');
    });

    it('is safe to call multiple times', async () => {
      await browser.ensureReady();
      await browser.close();
      await browser.close();
      // close on the manager should only be called once
      expect(mockManager.close).toHaveBeenCalledOnce();
    });
  });

  // =============================================================================
  // Core Tools (9)
  // =============================================================================

  describe('goto', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('navigates to a URL', async () => {
      const result = await browser.goto({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(mockPage.goto).toHaveBeenCalled();
    });

    it('supports waitUntil option', async () => {
      await browser.goto({ url: 'https://example.com', waitUntil: 'networkidle' });

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ waitUntil: 'networkidle' }),
      );
    });
  });

  describe('snapshot', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('returns accessibility tree snapshot', async () => {
      const result = await browser.snapshot({});

      expect(result.success).toBe(true);
      expect(result.snapshot).toContain('@e1');
      expect(result.title).toBe('Example');
      expect(result.url).toBe('https://example.com');
    });
  });

  describe('click', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      // Populate refMap by calling snapshot first
      await browser.snapshot({});
    });

    it('clicks an element by ref', async () => {
      const result = await browser.click({ ref: '@e1' });

      expect(result.success).toBe(true);
      expect(mockLocator.click).toHaveBeenCalled();
    });

    it('supports double-click via clickCount', async () => {
      await browser.click({ ref: '@e1', clickCount: 2 });

      expect(mockLocator.click).toHaveBeenCalledWith(expect.objectContaining({ clickCount: 2 }));
    });

    it('supports button option', async () => {
      await browser.click({ ref: '@e1', button: 'right' });

      expect(mockLocator.click).toHaveBeenCalledWith(expect.objectContaining({ button: 'right' }));
    });
  });

  describe('type', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('types text into an element', async () => {
      const result = await browser.type({ ref: '@e1', text: 'Hello World' });

      expect(result.success).toBe(true);
      expect(mockLocator.fill).toHaveBeenCalledWith('Hello World', expect.any(Object));
    });

    it('clears before typing when clear option is set', async () => {
      await browser.type({ ref: '@e1', text: 'New text', clear: true });

      // Should fill with empty string first to clear
      expect(mockLocator.fill).toHaveBeenCalledWith('', expect.any(Object));
      expect(mockLocator.fill).toHaveBeenCalledWith('New text', expect.any(Object));
    });
  });

  describe('press', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('presses a keyboard key', async () => {
      const result = await browser.press({ key: 'Enter' });

      expect(result.success).toBe(true);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    it('supports key combinations', async () => {
      await browser.press({ key: 'Control+a' });

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+a');
    });
  });

  describe('select', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('selects a dropdown option by value', async () => {
      const result = await browser.select({ ref: '@e1', value: 'option1' });

      expect(result.success).toBe(true);
      expect(result.selected).toEqual(['value1']);
      expect(mockLocator.selectOption).toHaveBeenCalled();
    });
  });

  describe('scroll', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('scrolls down', async () => {
      const result = await browser.scroll({ direction: 'down' });

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('scrolls element into view by ref', async () => {
      const result = await browser.scroll({ direction: 'down', ref: '@e1' });

      expect(result.success).toBe(true);
      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Extended Tools
  // =============================================================================

  describe('hover', () => {
    beforeEach(async () => {
      await browser.ensureReady();
      await browser.snapshot({});
    });

    it('hovers over an element', async () => {
      const result = await browser.hover({ ref: '@e1' });

      expect(result.success).toBe(true);
      expect(mockLocator.hover).toHaveBeenCalled();
    });
  });

  describe('back', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('navigates back', async () => {
      const result = await browser.back();

      expect(result.success).toBe(true);
      expect(mockPage.goBack).toHaveBeenCalled();
    });
  });

  // Tool tests (dialog, drag, evaluate) are in __tests__/*.test.ts

  // =============================================================================
  // Screencast
  // =============================================================================

  describe('screencast', () => {
    it('starts screencast when browser is ready', async () => {
      await browser.ensureReady();
      const stream = await browser.startScreencast();

      expect(stream).toBeDefined();
    });

    it('returns null when starting screencast if browser is not active', async () => {
      const stream = await browser.startScreencastIfBrowserActive();
      expect(stream).toBeNull();
    });
  });

  // =============================================================================
  // Lazy Initialization
  // =============================================================================

  describe('lazy initialization', () => {
    it('does not launch browser at construction time', () => {
      expect(mockManager.launch).not.toHaveBeenCalled();
    });

    it('launches browser only once for concurrent ensureReady calls', async () => {
      await Promise.all([browser.ensureReady(), browser.ensureReady()]);
      expect(mockManager.launch).toHaveBeenCalledOnce();
    });
  });
});

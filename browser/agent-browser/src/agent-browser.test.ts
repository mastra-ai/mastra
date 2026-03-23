import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mocks BEFORE vi.mock using vi.hoisted so they're available in the mock
const { mockPage, mockLocator, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: () => 'https://example.com',
    title: async () => 'Example',
    goto: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    reload: vi.fn(),
    close: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    evaluate: vi.fn(),
    viewportSize: () => ({ width: 1280, height: 720 }),
    content: vi.fn().mockResolvedValue('<html></html>'),
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
    }),
  };

  const mockLocator = {
    click: vi.fn(),
    dblclick: vi.fn(),
    fill: vi.fn(),
    selectOption: vi.fn(),
    check: vi.fn(),
    uncheck: vi.fn(),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    textContent: vi.fn().mockResolvedValue('text'),
    inputValue: vi.fn().mockResolvedValue('value'),
    scrollIntoViewIfNeeded: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
    getCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
    getSnapshot: vi.fn().mockResolvedValue({ tree: '- @e1 button "Click"' }),
    startScreencast: vi.fn().mockResolvedValue(undefined),
    stopScreencast: vi.fn().mockResolvedValue(undefined),
    injectMouseEvent: vi.fn().mockResolvedValue(undefined),
    injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
  };

  return { mockPage, mockLocator, mockManager };
});

vi.mock('agent-browser/dist/browser.js', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    getPage = mockManager.getPage;
    getLocatorFromRef = mockManager.getLocatorFromRef;
    getCDPSession = mockManager.getCDPSession;
    getSnapshot = mockManager.getSnapshot;
    startScreencast = mockManager.startScreencast;
    stopScreencast = mockManager.stopScreencast;
    injectMouseEvent = mockManager.injectMouseEvent;
    injectKeyboardEvent = mockManager.injectKeyboardEvent;
  },
}));

// Import AFTER vi.mock
import { AgentBrowser } from './agent-browser.js';

describe('AgentBrowser', () => {
  let browser: AgentBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    browser = new AgentBrowser();
  });

  afterEach(async () => {
    await browser.close();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets id to agent-browser', () => {
      expect(browser.id).toBe('agent-browser');
    });

    it('sets name to Agent Browser', () => {
      expect(browser.name).toBe('Agent Browser');
    });

    it('sets provider to vercel-labs/agent-browser', () => {
      expect(browser.provider).toBe('vercel-labs/agent-browser');
    });

    it('starts in pending status', () => {
      expect(browser.status).toBe('pending');
    });

    it('accepts custom config', () => {
      const custom = new AgentBrowser({ headless: false, timeout: 5000 });
      expect(custom.status).toBe('pending');
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

  describe('navigate', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('navigates to a URL', async () => {
      const result = (await browser.navigate({
        action: 'goto',
        url: 'https://example.com',
      })) as { success: boolean; url: string };

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(mockPage.goto).toHaveBeenCalled();
    });

    it('supports back navigation', async () => {
      const result = (await browser.navigate({ action: 'back' })) as { success: boolean };
      expect(result.success).toBe(true);
      expect(mockPage.goBack).toHaveBeenCalled();
    });

    it('supports forward navigation', async () => {
      const result = (await browser.navigate({ action: 'forward' })) as { success: boolean };
      expect(result.success).toBe(true);
      expect(mockPage.goForward).toHaveBeenCalled();
    });

    it('supports reload', async () => {
      const result = (await browser.navigate({ action: 'reload' })) as { success: boolean };
      expect(result.success).toBe(true);
      expect(mockPage.reload).toHaveBeenCalled();
    });
  });

  describe('interact', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('clicks an element by ref', async () => {
      const result = (await browser.interact({
        action: 'click',
        ref: '@e1',
      })) as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockLocator.click).toHaveBeenCalled();
    });

    it('double clicks an element', async () => {
      const result = (await browser.interact({
        action: 'double_click',
        ref: '@e1',
      })) as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockLocator.dblclick).toHaveBeenCalled();
    });
  });

  describe('input', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('fills text into an element', async () => {
      const result = (await browser.input({
        action: 'fill',
        ref: '@e1',
        value: 'Hello World',
      })) as { success: boolean };

      expect(result.success).toBe(true);
      expect(mockLocator.fill).toHaveBeenCalledWith('Hello World', expect.any(Object));
    });
  });

  describe('extract', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('takes a snapshot', async () => {
      const result = (await browser.extract({
        action: 'snapshot',
      })) as { success: boolean; snapshot: string };

      expect(result.success).toBe(true);
      expect(result.snapshot).toContain('@e1');
    });

    it('takes a screenshot', async () => {
      const result = (await browser.extract({
        action: 'screenshot',
      })) as { success: boolean; base64: string };

      expect(result.success).toBe(true);
      expect(result.base64).toBeDefined();
    });
  });

  describe('scroll', () => {
    beforeEach(async () => {
      await browser.ensureReady();
    });

    it('scrolls down', async () => {
      const result = (await browser.scroll({
        action: 'scroll',
        direction: 'down',
        amount: 300,
      })) as { success: boolean };

      expect(result.success).toBe(true);
    });
  });

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

  // Note: Event injection methods (injectMouseEvent, injectKeyboardEvent) are not yet
  // implemented in AgentBrowser. The base class throws "not supported" by default.
  // These tests should be enabled once AgentBrowser implements event injection.

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

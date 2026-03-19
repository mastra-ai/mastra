import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserManagerLike } from './browser-types.js';
import { BrowserToolset } from './toolset.js';

// Mock the dynamic import of agent-browser so we never launch a real browser
const mockManager: BrowserManagerLike = {
  launch: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  getPage: vi.fn().mockReturnValue({
    url: () => 'https://example.com',
    title: async () => 'Example',
    goto: vi.fn(),
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    viewportSize: () => ({ width: 1280, height: 720 }),
  }),
  getLocatorFromRef: vi.fn().mockReturnValue(null),
  getCDPSession: vi.fn().mockResolvedValue({ send: vi.fn() }),
  getSnapshot: vi.fn().mockResolvedValue({ tree: '' }),
  startScreencast: vi.fn().mockResolvedValue(undefined),
  stopScreencast: vi.fn().mockResolvedValue(undefined),
  injectMouseEvent: vi.fn().mockResolvedValue(undefined),
  injectKeyboardEvent: vi.fn().mockResolvedValue(undefined),
};

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

describe('BrowserToolset', () => {
  let toolset: BrowserToolset;

  beforeEach(() => {
    vi.clearAllMocks();
    toolset = new BrowserToolset();
  });

  afterEach(async () => {
    await toolset.close();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('registers all 8 browser tools', () => {
      const toolNames = Object.keys(toolset.tools);
      expect(toolNames).toEqual([
        'browser_navigate',
        'browser_snapshot',
        'browser_click',
        'browser_type',
        'browser_select',
        'browser_scroll',
        'browser_screenshot',
        'browser_close',
      ]);
    });

    it('sets name to agent-browser', () => {
      expect(toolset.name).toBe('agent-browser');
    });

    it('applies default config when none provided', () => {
      // Default is headless: true, timeout: 10_000
      // We can verify indirectly: browser is not launched at construction
      expect(toolset.isBrowserRunning()).toBe(false);
    });

    it('accepts custom config', () => {
      const custom = new BrowserToolset({ headless: false, timeout: 5000 });
      expect(custom.isBrowserRunning()).toBe(false);
    });
  });

  describe('isBrowserRunning', () => {
    it('returns false before any tool use', () => {
      expect(toolset.isBrowserRunning()).toBe(false);
    });

    it('returns true after browser is launched', async () => {
      // Trigger lazy init by accessing getBrowser via a tool execution
      // We access the private getBrowser via the navigate tool
      const tool = toolset.tools.browser_navigate;
      // Call execute to trigger lazy init
      await tool.execute!({ url: 'https://example.com', waitUntil: 'domcontentloaded' }, {} as any);
      expect(toolset.isBrowserRunning()).toBe(true);
    });
  });

  describe('getCurrentUrl', () => {
    it('returns null before browser is launched', () => {
      expect(toolset.getCurrentUrl()).toBeNull();
    });

    it('returns the current URL after browser launches', async () => {
      // Launch by executing a tool
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );
      expect(toolset.getCurrentUrl()).toBe('https://example.com');
    });
  });

  describe('onBrowserReady', () => {
    it('invokes callback immediately if browser is already running', async () => {
      // Launch browser first
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );

      const callback = vi.fn();
      toolset.onBrowserReady(callback);
      expect(callback).toHaveBeenCalledOnce();
    });

    it('invokes callback when browser becomes ready', async () => {
      const callback = vi.fn();
      toolset.onBrowserReady(callback);

      // Not called yet
      expect(callback).not.toHaveBeenCalled();

      // Launch browser
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );
      expect(callback).toHaveBeenCalledOnce();
    });

    it('returns a cleanup function that unregisters the callback', async () => {
      const callback = vi.fn();
      const cleanup = toolset.onBrowserReady(callback);
      cleanup();

      // Launch browser — callback should NOT be called
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('is a no-op when browser has not been launched', async () => {
      await toolset.close();
      expect(mockManager.close).not.toHaveBeenCalled();
    });

    it('closes the browser and resets state', async () => {
      // Launch first
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );
      expect(toolset.isBrowserRunning()).toBe(true);

      await toolset.close();
      expect(mockManager.close).toHaveBeenCalledOnce();
      expect(toolset.isBrowserRunning()).toBe(false);
    });

    it('is safe to call multiple times', async () => {
      await toolset.tools.browser_navigate.execute!(
        { url: 'https://example.com', waitUntil: 'domcontentloaded' },
        {} as any,
      );
      await toolset.close();
      await toolset.close();
      // close on the manager should only be called once
      expect(mockManager.close).toHaveBeenCalledOnce();
    });
  });

  describe('startScreencastIfBrowserActive', () => {
    it('returns null when browser is not running', async () => {
      const result = await toolset.startScreencastIfBrowserActive();
      expect(result).toBeNull();
    });
  });

  describe('injectMouseEvent', () => {
    it('launches browser and injects the event', async () => {
      const event = { type: 'mouseMoved' as const, x: 100, y: 200 };
      await toolset.injectMouseEvent(event);
      expect(mockManager.injectMouseEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('injectKeyboardEvent', () => {
    it('launches browser and injects the event', async () => {
      const event = { type: 'keyDown' as const, key: 'Enter' };
      await toolset.injectKeyboardEvent(event);
      expect(mockManager.injectKeyboardEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('lazy initialization', () => {
    it('does not launch browser at construction time', () => {
      expect(mockManager.launch).not.toHaveBeenCalled();
    });

    it('launches browser only once for concurrent tool calls', async () => {
      await Promise.all([
        toolset.tools.browser_navigate.execute!({ url: 'https://a.com', waitUntil: 'domcontentloaded' }, {} as any),
        toolset.tools.browser_navigate.execute!({ url: 'https://b.com', waitUntil: 'domcontentloaded' }, {} as any),
      ]);
      expect(mockManager.launch).toHaveBeenCalledOnce();
    });
  });
});

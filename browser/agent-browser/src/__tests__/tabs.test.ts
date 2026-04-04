/**
 * Tests for browser_tabs tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example Page'),
    goto: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    listTabs: vi.fn().mockResolvedValue([
      { index: 0, url: 'https://example.com', title: 'Example', active: true },
      { index: 1, url: 'https://google.com', title: 'Google', active: false },
    ]),
    newTab: vi.fn().mockResolvedValue({ index: 2, total: 3 }),
    switchTo: vi.fn().mockResolvedValue({ index: 1, url: 'https://google.com', title: 'Google' }),
    closeTab: vi.fn().mockResolvedValue({ closed: 1, remaining: 1 }),
  };

  return { mockPage, mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
    listTabs = mockManager.listTabs;
    newTab = mockManager.newTab;
    switchTo = mockManager.switchTo;
    closeTab = mockManager.closeTab;
  },
}));

import { AgentBrowser } from '../agent-browser';

describe('browser_tabs', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  describe('list action', () => {
    it('lists all open tabs', async () => {
      const result = await browser.tabs({ action: 'list' });

      expect(mockManager.listTabs).toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tabs).toHaveLength(2);
      }
    });

    it('returns hint about switching tabs', async () => {
      const result = await browser.tabs({ action: 'list' });

      expect(result.success).toBe(true);
      if (result.success) expect(result.hint).toContain('switch');
    });
  });

  describe('new action', () => {
    it('opens a new tab', async () => {
      const result = await browser.tabs({ action: 'new' });

      expect(mockManager.newTab).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('opens a new tab and navigates to URL', async () => {
      const result = await browser.tabs({ action: 'new', url: 'https://github.com' });

      expect(mockManager.newTab).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://github.com');
      expect(result.success).toBe(true);
    });

    it('returns hint about taking snapshot', async () => {
      const result = await browser.tabs({ action: 'new' });

      expect(result.success).toBe(true);
      if (result.success) expect(result.hint).toContain('snapshot');
    });
  });

  describe('switch action', () => {
    it('switches to specified tab index', async () => {
      const result = await browser.tabs({ action: 'switch', index: 1 });

      expect(mockManager.switchTo).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('returns tab info after switch', async () => {
      const result = await browser.tabs({ action: 'switch', index: 1 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.index).toBe(1);
        expect(result.url).toBe('https://example.com');
      }
    });

    it('returns hint about taking snapshot', async () => {
      const result = await browser.tabs({ action: 'switch', index: 0 });

      expect(result.success).toBe(true);
      if (result.success) expect(result.hint).toContain('snapshot');
    });
  });

  describe('close action', () => {
    it('closes the current tab', async () => {
      const result = await browser.tabs({ action: 'close' });

      expect(mockManager.closeTab).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('closes tab at specified index', async () => {
      const result = await browser.tabs({ action: 'close', index: 1 });

      expect(mockManager.closeTab).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it('returns remaining tab count', async () => {
      // After close, listTabs is called to get remaining count
      mockManager.listTabs.mockResolvedValueOnce([
        { index: 0, url: 'https://example.com', title: 'Example', active: true },
      ]);

      const result = await browser.tabs({ action: 'close' });

      expect(result.success).toBe(true);
      if (result.success) expect(result.remaining).toBe(1);
    });
  });

  describe('error handling', () => {
    it('returns error when browser not launched', async () => {
      mockManager.isLaunched.mockReturnValue(false);
      const newBrowser = new AgentBrowser({ scope: 'shared' });
      // Don't call launch

      const result = await newBrowser.tabs({ action: 'list' });

      expect(result.success).toBe(false);
    });

    it('returns error for unsupported action', async () => {
      // @ts-expect-error Testing invalid action
      const result = await browser.tabs({ action: 'invalid' });

      expect(result.success).toBe(false);
    });
  });
});

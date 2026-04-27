/**
 * Tests for browser_wait tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockLocator, mockManager } = vi.hoisted(() => {
  const mockLocator = {
    waitFor: vi.fn(),
  };

  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    waitForTimeout: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
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
  },
}));

import { AgentBrowser } from '../agent-browser';

describe('browser_wait', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  describe('wait for element', () => {
    it('waits for element to be visible (default state)', async () => {
      const result = await browser.wait({ ref: '@element' });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: expect.any(Number) });
      expect(result.success).toBe(true);
    });

    it('waits for element to be hidden', async () => {
      const result = await browser.wait({ ref: '@element', state: 'hidden' });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({ state: 'hidden', timeout: expect.any(Number) });
      expect(result.success).toBe(true);
    });

    it('waits for element to be attached', async () => {
      const result = await browser.wait({ ref: '@element', state: 'attached' });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: expect.any(Number) });
      expect(result.success).toBe(true);
    });

    it('waits for element to be detached', async () => {
      const result = await browser.wait({ ref: '@element', state: 'detached' });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({ state: 'detached', timeout: expect.any(Number) });
      expect(result.success).toBe(true);
    });

    it('uses custom timeout', async () => {
      const result = await browser.wait({ ref: '@element', timeout: 5000 });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 5000 });
      expect(result.success).toBe(true);
    });

    it('returns error for invalid ref', async () => {
      mockManager.getLocatorFromRef.mockReturnValueOnce(null);

      const result = await browser.wait({ ref: '@invalid' });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe('stale_ref');
    });

    it('returns error when waitFor times out', async () => {
      mockLocator.waitFor.mockRejectedValueOnce(new Error('Timeout 30000ms exceeded'));

      const result = await browser.wait({ ref: '@element' });

      expect(result.success).toBe(false);
    });
  });

  describe('wait for timeout', () => {
    it('waits for specified timeout without ref', async () => {
      const result = await browser.wait({ timeout: 1000 });

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
      expect(result.success).toBe(true);
    });

    it('uses default timeout when none specified', async () => {
      const result = await browser.wait({});

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(30000); // default timeout
      expect(result.success).toBe(true);
    });
  });

  describe('hints', () => {
    it('returns hint about element state', async () => {
      const result = await browser.wait({ ref: '@element', state: 'visible' });

      expect(result.success).toBe(true);
      if (result.success) expect(result.hint).toContain('visible');
    });

    it('returns hint about wait completion', async () => {
      const result = await browser.wait({ timeout: 1000 });

      expect(result.success).toBe(true);
      if (result.success) expect(result.hint).toContain('Wait complete');
    });
  });
});

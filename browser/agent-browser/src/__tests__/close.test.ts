/**
 * Tests for browser_close tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
  };

  return { mockManager };
});

vi.mock('agent-browser', () => ({
  BrowserManager: class {
    launch = mockManager.launch;
    close = mockManager.close;
    isLaunched = mockManager.isLaunched;
    getPage = mockManager.getPage;
  },
}));

import { AgentBrowser } from '../agent-browser';

describe('browser_close', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    // Browser may already be closed
    if (browser.status === 'ready') {
      await browser.close();
    }
  });

  it('closes the browser', async () => {
    expect(browser.status).toBe('ready');

    await browser.close();

    expect(browser.status).toBe('closed');
  });

  it('can be called multiple times safely', async () => {
    await browser.close();
    await browser.close(); // Should not throw

    expect(browser.status).toBe('closed');
  });

  it('transitions status from ready to closed', async () => {
    expect(browser.status).toBe('ready');

    await browser.close();

    expect(browser.status).toBe('closed');
  });

  it('sets isBrowserRunning to false after close', async () => {
    expect(browser.isBrowserRunning()).toBe(true);

    await browser.close();

    expect(browser.isBrowserRunning()).toBe(false);
  });
});

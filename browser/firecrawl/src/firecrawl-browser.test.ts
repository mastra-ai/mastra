import type { Firecrawl } from 'firecrawl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  browser: vi.fn(),
  deleteBrowser: vi.fn(),
  launch: vi.fn(),
  close: vi.fn(),
  getPage: vi.fn(() => ({ url: vi.fn(() => 'about:blank') })),
}));

vi.mock('firecrawl', () => ({
  Firecrawl: class MockFirecrawl {
    browser = mocks.browser;
    deleteBrowser = mocks.deleteBrowser;
  },
}));

vi.mock('agent-browser', () => ({
  BrowserManager: class MockBrowserManager {
    launch = mocks.launch;
    close = mocks.close;
    getPage = mocks.getPage;
  },
}));

vi.mock('./resolve-cdp', () => ({
  resolveCdpWebSocketUrl: vi.fn(async () => 'wss://browser.example'),
}));

import { FirecrawlBrowser } from './firecrawl-browser';
import { FirecrawlAgentBrowserThreadManager } from './firecrawl-thread-manager';

const receipt = {
  success: true,
  sessionDurationMs: 12_345,
  creditsBilled: 0.42,
};

describe('Firecrawl session deletion receipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.browser.mockResolvedValue({
      success: true,
      id: 'session-1',
      cdpUrl: 'https://browser.example',
    });
    mocks.deleteBrowser.mockResolvedValue(receipt);
    mocks.launch.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
  });

  it('emits the provider receipt when a shared session closes', async () => {
    const onSessionDeleted = vi.fn();
    const browser = new FirecrawlBrowser({
      apiKey: 'test-key',
      scope: 'shared',
      onSessionDeleted,
    });

    await browser.launch();
    await browser.close();

    expect(mocks.deleteBrowser).toHaveBeenCalledWith('session-1');
    expect(onSessionDeleted).toHaveBeenCalledWith({ sessionId: 'session-1', receipt });
  });

  it('emits the provider receipt with the thread ID when a thread session closes', async () => {
    const onSessionDeleted = vi.fn();
    const firecrawl = {
      browser: mocks.browser,
      deleteBrowser: mocks.deleteBrowser,
    } as unknown as Firecrawl;
    const manager = new FirecrawlAgentBrowserThreadManager({
      scope: 'thread',
      browserConfig: {},
      firecrawl,
      resolveWebSocketUrl: vi.fn(async () => 'wss://browser.example'),
      onSessionDeleted,
    });

    await manager.getManagerForThread('thread-1');
    await manager.destroySession('thread-1');

    expect(onSessionDeleted).toHaveBeenCalledWith({
      sessionId: 'session-1',
      threadId: 'thread-1',
      receipt,
    });
  });

  it('emits the provider receipt during failed-launch cleanup without masking the launch error', async () => {
    const onSessionDeleted = vi.fn();
    mocks.launch.mockRejectedValueOnce(new Error('CDP launch failed'));
    const browser = new FirecrawlBrowser({
      apiKey: 'test-key',
      scope: 'shared',
      onSessionDeleted,
    });

    await expect(browser.launch()).rejects.toThrow('CDP launch failed');

    expect(onSessionDeleted).toHaveBeenCalledWith({ sessionId: 'session-1', receipt });
  });

  it('keeps cleanup successful when the receipt callback throws', async () => {
    const browser = new FirecrawlBrowser({
      apiKey: 'test-key',
      scope: 'shared',
      onSessionDeleted: vi.fn().mockRejectedValue(new Error('observer unavailable')),
    });

    await browser.launch();
    await expect(browser.close()).resolves.toBeUndefined();

    expect(browser.status).toBe('closed');
  });
});

/**
 * Tests for browser_dialog tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    once: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
  };

  return { mockPage, mockManager };
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

describe('browser_dialog', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ threadIsolation: 'none' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('accepts an alert dialog', async () => {
    const mockDialog = {
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ action: 'accept' });

    expect(mockDialog.accept).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) expect(result.action).toBe('accept');
  });

  it('dismisses a confirm dialog', async () => {
    const mockDialog = {
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ action: 'dismiss' });

    expect(mockDialog.dismiss).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) expect(result.action).toBe('dismiss');
  });

  it('accepts a prompt with text', async () => {
    const mockDialog = {
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ action: 'accept', text: 'John Doe' });

    expect(mockDialog.accept).toHaveBeenCalledWith('John Doe');
    expect(result.success).toBe(true);
  });

  it('times out if no dialog appears', async () => {
    mockPage.once.mockImplementation(() => {
      // Don't trigger dialog
    });

    const fastBrowser = new AgentBrowser({ threadIsolation: 'none', timeout: 50 });
    await fastBrowser.launch();

    await expect(fastBrowser.dialog({ action: 'accept' })).rejects.toThrow('timed out');

    await fastBrowser.close();
  });

  it('returns hint about taking snapshot', async () => {
    const mockDialog = {
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ action: 'accept' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.hint).toContain('snapshot');
  });
});

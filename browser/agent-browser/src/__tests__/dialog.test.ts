/**
 * Tests for browser_dialog tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLocator, mockPage, mockManager } = vi.hoisted(() => {
  const mockLocator = {
    click: vi.fn().mockResolvedValue(undefined),
  };

  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    once: vi.fn(),
    off: vi.fn(),
  };

  const mockManager = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isLaunched: vi.fn().mockReturnValue(true),
    getPage: vi.fn().mockReturnValue(mockPage),
    getLocatorFromRef: vi.fn().mockReturnValue(mockLocator),
  };

  return { mockLocator, mockPage, mockManager };
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

describe('browser_dialog', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('clicks trigger and accepts an alert dialog', async () => {
    const mockDialog = {
      type: vi.fn().mockReturnValue('alert'),
      message: vi.fn().mockReturnValue('Hello!'),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ triggerRef: '@e1', action: 'accept' });

    expect(mockLocator.click).toHaveBeenCalled();
    expect(mockDialog.accept).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.action).toBe('accept');
      expect(result.dialogType).toBe('alert');
      expect(result.message).toBe('Hello!');
    }
  });

  it('clicks trigger and dismisses a confirm dialog', async () => {
    const mockDialog = {
      type: vi.fn().mockReturnValue('confirm'),
      message: vi.fn().mockReturnValue('Are you sure?'),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ triggerRef: '@e2', action: 'dismiss' });

    expect(mockLocator.click).toHaveBeenCalled();
    expect(mockDialog.dismiss).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.action).toBe('dismiss');
      expect(result.dialogType).toBe('confirm');
    }
  });

  it('accepts a prompt with text', async () => {
    const mockDialog = {
      type: vi.fn().mockReturnValue('prompt'),
      message: vi.fn().mockReturnValue('Enter your name:'),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ triggerRef: '@e3', action: 'accept', text: 'John Doe' });

    expect(mockDialog.accept).toHaveBeenCalledWith('John Doe');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.dialogType).toBe('prompt');
    }
  });

  it('returns error if trigger ref not found', async () => {
    mockManager.getLocatorFromRef.mockReturnValueOnce(null);

    const result = await browser.dialog({ triggerRef: '@invalid', action: 'accept' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('stale_ref');
      expect(result.message).toContain('@invalid');
    }
  });

  it('times out if no dialog appears after click', async () => {
    mockPage.once.mockImplementation(() => {
      // Don't trigger dialog
    });

    const fastBrowser = new AgentBrowser({ scope: 'shared', timeout: 50 });
    await fastBrowser.launch();

    await expect(fastBrowser.dialog({ triggerRef: '@e1', action: 'accept' })).rejects.toThrow('No dialog appeared');

    await fastBrowser.close();
  });

  it('returns hint about taking snapshot', async () => {
    const mockDialog = {
      type: vi.fn().mockReturnValue('alert'),
      message: vi.fn().mockReturnValue('Done!'),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockResolvedValue(undefined),
    };

    mockPage.once.mockImplementation((event: string, handler: (d: unknown) => void) => {
      if (event === 'dialog') setImmediate(() => handler(mockDialog));
    });

    const result = await browser.dialog({ triggerRef: '@e1', action: 'accept' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.hint).toContain('snapshot');
  });
});

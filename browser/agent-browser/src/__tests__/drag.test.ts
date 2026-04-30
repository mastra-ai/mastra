/**
 * Tests for browser_drag tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sourceLocator, targetLocator, selectorSourceLocator, selectorTargetLocator, mockPage, mockManager } =
  vi.hoisted(() => {
    const sourceLocator = { dragTo: vi.fn() };
    const targetLocator = { dragTo: vi.fn() };
    const selectorSourceLocator = { dragTo: vi.fn() };
    const selectorTargetLocator = { dragTo: vi.fn() };

    const mockPage = {
      url: vi.fn().mockReturnValue('https://example.com'),
      locator: vi.fn((selector: string) => {
        if (selector === '#source') return selectorSourceLocator;
        if (selector === '#target') return selectorTargetLocator;
        return null;
      }),
    };

    const mockManager = {
      launch: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isLaunched: vi.fn().mockReturnValue(true),
      getPage: vi.fn().mockReturnValue(mockPage),
      getLocatorFromRef: vi.fn((ref: string) => {
        if (ref === '@source') return sourceLocator;
        if (ref === '@target') return targetLocator;
        return null;
      }),
    };

    return { sourceLocator, targetLocator, selectorSourceLocator, selectorTargetLocator, mockPage, mockManager };
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

describe('browser_drag', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the ref mapping
    mockManager.getLocatorFromRef.mockImplementation((ref: string) => {
      if (ref === '@source') return sourceLocator;
      if (ref === '@target') return targetLocator;
      return null;
    });
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('drags from source to target', async () => {
    const result = await browser.drag({ sourceRef: '@source', targetRef: '@target' });

    expect(sourceLocator.dragTo).toHaveBeenCalledWith(targetLocator, expect.any(Object));
    expect(result.success).toBe(true);
  });

  it('returns error for invalid source ref', async () => {
    mockManager.getLocatorFromRef.mockImplementation((ref: string) => {
      if (ref === '@target') return targetLocator;
      return null;
    });

    const result = await browser.drag({ sourceRef: '@invalid', targetRef: '@target' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('stale_ref');
  });

  it('returns error for invalid target ref', async () => {
    mockManager.getLocatorFromRef.mockImplementation((ref: string) => {
      if (ref === '@source') return sourceLocator;
      return null;
    });

    const result = await browser.drag({ sourceRef: '@source', targetRef: '@invalid' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('stale_ref');
  });

  it('returns error when dragTo fails', async () => {
    sourceLocator.dragTo.mockRejectedValueOnce(new Error('Element not draggable'));

    const result = await browser.drag({ sourceRef: '@source', targetRef: '@target' });

    expect(result.success).toBe(false);
  });

  it('returns hint about taking snapshot', async () => {
    const result = await browser.drag({ sourceRef: '@source', targetRef: '@target' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.hint).toContain('snapshot');
  });

  it('drags using CSS selectors when refs not available', async () => {
    const result = await browser.drag({ sourceSelector: '#source', targetSelector: '#target' });

    expect(mockPage.locator).toHaveBeenCalledWith('#source');
    expect(mockPage.locator).toHaveBeenCalledWith('#target');
    expect(selectorSourceLocator.dragTo).toHaveBeenCalledWith(selectorTargetLocator, expect.any(Object));
    expect(result.success).toBe(true);
  });

  it('can mix ref and selector', async () => {
    const result = await browser.drag({ sourceRef: '@source', targetSelector: '#target' });

    expect(sourceLocator.dragTo).toHaveBeenCalledWith(selectorTargetLocator, expect.any(Object));
    expect(result.success).toBe(true);
  });

  it('returns error when no source specified', async () => {
    const result = await browser.drag({ targetRef: '@target' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toContain('No source element');
  });

  it('returns error when no target specified', async () => {
    const result = await browser.drag({ sourceRef: '@source' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.message).toContain('No target element');
  });
});

/**
 * Tests for browser_evaluate tool
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPage, mockManager } = vi.hoisted(() => {
  const mockPage = {
    url: vi.fn().mockReturnValue('https://example.com'),
    evaluate: vi.fn(),
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

describe('browser_evaluate', () => {
  let browser: AgentBrowser;

  beforeEach(async () => {
    vi.clearAllMocks();
    browser = new AgentBrowser({ scope: 'shared' });
    await browser.launch();
  });

  afterEach(async () => {
    await browser.close();
  });

  it('passes script directly to page.evaluate', async () => {
    mockPage.evaluate.mockResolvedValue(42);

    await browser.evaluate({ script: '1 + 41' });

    expect(mockPage.evaluate).toHaveBeenCalledWith('1 + 41');
  });

  it('returns number result', async () => {
    mockPage.evaluate.mockResolvedValue(42);

    const result = await browser.evaluate({ script: '1 + 41' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(42);
  });

  it('returns string result', async () => {
    mockPage.evaluate.mockResolvedValue('Hello World');

    const result = await browser.evaluate({ script: '"Hello World"' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe('Hello World');
  });

  it('returns object result', async () => {
    const obj = { name: 'John', age: 30 };
    mockPage.evaluate.mockResolvedValue(obj);

    const result = await browser.evaluate({ script: '({ name: "John", age: 30 })' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toEqual(obj);
  });

  it('returns array result', async () => {
    mockPage.evaluate.mockResolvedValue([1, 2, 3]);

    const result = await browser.evaluate({ script: '[1, 2, 3]' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toEqual([1, 2, 3]);
  });

  it('returns null', async () => {
    mockPage.evaluate.mockResolvedValue(null);

    const result = await browser.evaluate({ script: 'null' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeNull();
  });

  it('returns undefined for side-effect scripts', async () => {
    mockPage.evaluate.mockResolvedValue(undefined);

    const result = await browser.evaluate({ script: 'console.log("hi")' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeUndefined();
  });

  it('returns error for syntax errors', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('SyntaxError'));

    const result = await browser.evaluate({ script: '{invalid' });

    expect(result.success).toBe(false);
  });

  it('returns error for runtime errors', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('ReferenceError: x is not defined'));

    const result = await browser.evaluate({ script: 'x' });

    expect(result.success).toBe(false);
  });

  it('returns error for thrown exceptions', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('Custom error'));

    const result = await browser.evaluate({ script: 'throw new Error("Custom error")' });

    expect(result.success).toBe(false);
  });

  it('returns hint about taking snapshot', async () => {
    mockPage.evaluate.mockResolvedValue(true);

    const result = await browser.evaluate({ script: 'true' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.hint).toContain('snapshot');
  });

  it('handles empty script', async () => {
    mockPage.evaluate.mockResolvedValue(undefined);

    const result = await browser.evaluate({ script: '' });

    expect(result.success).toBe(true);
  });
});

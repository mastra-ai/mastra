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

  it('evaluates script and returns number result', async () => {
    mockPage.evaluate.mockResolvedValue(42);

    const result = await browser.evaluate({ script: 'return 1 + 41' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(42);
  });

  it('evaluates script and returns string result', async () => {
    mockPage.evaluate.mockResolvedValue('Hello World');

    const result = await browser.evaluate({ script: 'return "Hello World"' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe('Hello World');
  });

  it('evaluates script and returns object result', async () => {
    const obj = { name: 'John', age: 30 };
    mockPage.evaluate.mockResolvedValue(obj);

    const result = await browser.evaluate({ script: 'return { name: "John", age: 30 }' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toEqual(obj);
  });

  it('evaluates script and returns array result', async () => {
    mockPage.evaluate.mockResolvedValue([1, 2, 3]);

    const result = await browser.evaluate({ script: 'return [1, 2, 3]' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toEqual([1, 2, 3]);
  });

  it('evaluates script and returns null', async () => {
    mockPage.evaluate.mockResolvedValue(null);

    const result = await browser.evaluate({ script: 'return null' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeNull();
  });

  it('evaluates script and returns undefined', async () => {
    mockPage.evaluate.mockResolvedValue(undefined);

    const result = await browser.evaluate({ script: 'console.log("hi")' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBeUndefined();
  });

  it('returns error for syntax errors', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('SyntaxError'));

    const result = await browser.evaluate({ script: 'return {' });

    expect(result.success).toBe(false);
  });

  it('returns error for runtime errors', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('ReferenceError: x is not defined'));

    const result = await browser.evaluate({ script: 'return x' });

    expect(result.success).toBe(false);
  });

  it('returns error for thrown exceptions', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('Custom error'));

    const result = await browser.evaluate({ script: 'throw new Error("Custom error")' });

    expect(result.success).toBe(false);
  });

  it('handles async scripts', async () => {
    mockPage.evaluate.mockResolvedValue('resolved');

    const result = await browser.evaluate({ script: 'return await Promise.resolve("resolved")' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe('resolved');
  });

  it('returns hint about taking snapshot', async () => {
    mockPage.evaluate.mockResolvedValue(true);

    const result = await browser.evaluate({ script: 'return true' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.hint).toContain('snapshot');
  });

  it('handles empty script', async () => {
    mockPage.evaluate.mockResolvedValue(undefined);

    const result = await browser.evaluate({ script: '' });

    expect(result.success).toBe(true);
  });

  describe('script wrapping', () => {
    // These tests use a realistic mock that actually evaluates the wrapped
    // script string, so they verify the wrapping logic produces correct JS.
    function useRealisticEvaluate() {
      mockPage.evaluate.mockImplementation((script: string) => {
        const fn = new Function(`return ${script}`) as () => Promise<unknown>;
        return fn();
      });
    }

    it('returns result from bare expression scripts', async () => {
      // Models commonly send bare expressions like document.body.innerText
      // These must produce a return value, not undefined.
      // We use JSON.stringify here to simulate an expression with method calls,
      // since document.body isn't available in the Node test environment.
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: 'JSON.stringify({ a: 1 })' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe('{"a":1}');
      }
    });

    it('returns result from expression with property access', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: '1 + 41' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe(42);
      }
    });

    it('returns result from scripts with explicit return', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: 'return 42' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe(42);
      }
    });

    it('handles multi-statement scripts with explicit return', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: 'const x = 1; const y = 2; return x + y' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe(3);
      }
    });

    it('handles async expression scripts', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: 'await Promise.resolve("hello")' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe('hello');
      }
    });

    it('handles scripts that are just a string literal', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: '"hello world"' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe('hello world');
      }
    });

    it('handles void/side-effect scripts without return', async () => {
      useRealisticEvaluate();

      const result = await browser.evaluate({ script: 'console.log("hi")' });

      expect(result.success).toBe(true);
      // Side-effect-only scripts returning undefined is acceptable
    });
  });
});

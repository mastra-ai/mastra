/**
 * Tests for {@link IsolatedVmCodeModeTransport}.
 *
 * These run against real V8 isolates (the vitest config passes
 * `--no-node-snapshot` to the worker processes), so they exercise the actual
 * isolation boundary: no fakes, no process spawning, no network.
 */

import { createCodeMode, createTool } from '@mastra/core/tools';
import type { CodeModeToolDispatcher, CodeModeToolResult } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { IsolatedVmCodeModeTransport } from './transport';

function run(
  program: string,
  overrides: Partial<{
    toolIds: string[];
    dispatch: CodeModeToolDispatcher;
    timeout: number;
    abortSignal: AbortSignal;
    onExternalCall: (tool: string, args: unknown) => void;
    onExternalResult: (tool: string, durationMs: number, error?: unknown) => void;
    transport: IsolatedVmCodeModeTransport;
  }> = {},
): Promise<CodeModeToolResult> {
  const transport = overrides.transport ?? new IsolatedVmCodeModeTransport();
  return transport.run({
    program,
    toolIds: overrides.toolIds ?? [],
    dispatch: overrides.dispatch ?? (async () => undefined),
    timeout: overrides.timeout ?? 5_000,
    abortSignal: overrides.abortSignal,
    onExternalCall: overrides.onExternalCall,
    onExternalResult: overrides.onExternalResult,
  });
}

describe('IsolatedVmCodeModeTransport', () => {
  it('declares that it does not require a sandbox', () => {
    expect(new IsolatedVmCodeModeTransport().requiresSandbox).toBe(false);
  });

  it('fails fast in the constructor when --no-node-snapshot is missing on Node 20+', () => {
    // Test workers run with the flag, so simulate its absence.
    const originalExecArgv = Object.getOwnPropertyDescriptor(process, 'execArgv')!;
    Object.defineProperty(process, 'execArgv', { value: [], configurable: true });
    vi.stubEnv('NODE_OPTIONS', '');
    try {
      expect(() => new IsolatedVmCodeModeTransport()).toThrow(/--no-node-snapshot/);
    } finally {
      Object.defineProperty(process, 'execArgv', originalExecArgv);
      vi.unstubAllEnvs();
    }
  });

  it('runs a program and returns its result', async () => {
    const result = await run(`return 1 + 2;`);
    expect(result).toEqual({ success: true, result: 3, logs: [] });
  });

  it('strips TypeScript annotations before evaluation', async () => {
    const result = await run(`
      const double = (n: number): number => n * 2;
      const values: number[] = [1, 2, 3];
      return values.map(double);
    `);
    expect(result.success).toBe(true);
    expect(result.result).toEqual([2, 4, 6]);
  });

  it('captures console output as logs', async () => {
    const result = await run(`
      console.log('hello', { a: 1 });
      console.warn('careful');
      return null;
    `);
    expect(result.success).toBe(true);
    expect(result.logs).toEqual(['hello {"a":1}', 'careful']);
  });

  it('bridges external_* calls to the host dispatcher', async () => {
    const dispatch = vi.fn(async (tool: string, args: any) => ({ echoed: { tool, args } }));
    const result = await run(`const r = await external_lookup({ id: 'x' }); return r.echoed;`, {
      toolIds: ['lookup'],
      dispatch,
    });
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ tool: 'lookup', args: { id: 'x' } });
    expect(dispatch).toHaveBeenCalledWith('lookup', { id: 'x' });
  });

  it('resolves concurrent external_* calls independently (Promise.all)', async () => {
    const dispatch: CodeModeToolDispatcher = async (_tool, args) => {
      const { n } = args as { n: number };
      // Reverse-order delays so completion order differs from call order.
      await new Promise(resolve => setTimeout(resolve, (3 - n) * 20));
      return n * 10;
    };
    const result = await run(
      `
      const [a, b, c] = await Promise.all([
        external_calc({ n: 1 }),
        external_calc({ n: 2 }),
        external_calc({ n: 3 }),
      ]);
      return [a, b, c];
      `,
      { toolIds: ['calc'], dispatch },
    );
    expect(result.success).toBe(true);
    expect(result.result).toEqual([10, 20, 30]);
  });

  it('sanitizes non-identifier tool ids for external_* names', async () => {
    const dispatch = vi.fn(async () => 'ok');
    const result = await run(`return await external_my_tool({});`, {
      toolIds: ['my-tool'],
      dispatch,
    });
    expect(result.success).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('my-tool', {});
  });

  it('propagates dispatcher errors into the guest with the original name', async () => {
    const dispatch: CodeModeToolDispatcher = async () => {
      const err = new Error('boom');
      err.name = 'CustomError';
      throw err;
    };
    const result = await run(
      `
      try {
        await external_fail({});
      } catch (e) {
        return { message: e.message, name: e.name };
      }
      `,
      { toolIds: ['fail'], dispatch },
    );
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ message: 'boom', name: 'CustomError' });
  });

  it('rejects non-JSON-serializable arguments to external_* calls', async () => {
    const dispatch = vi.fn(async () => 'ok');
    const result = await run(
      `
      try {
        await external_calc({ n: 1n });
      } catch (e) {
        return e.message;
      }
      `,
      { toolIds: ['calc'], dispatch },
    );
    expect(result.success).toBe(true);
    expect(result.result).toMatch(/JSON-serializable/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns an error result when the program throws', async () => {
    const result = await run(`throw new TypeError('bad input');`);
    expect(result.success).toBe(false);
    expect(result.error).toEqual({ message: 'bad input', name: 'TypeError' });
  });

  it('returns a SyntaxError result for an unparsable program', async () => {
    const result = await run(`const = ;`);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('SyntaxError');
  });

  it('returns an error result for non-JSON-serializable results', async () => {
    const result = await run(`const a = {}; a.self = a; return a;`);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TypeError');
    expect(result.error?.message).toMatch(/not JSON-serializable/);
  });

  it('times out a program that hangs on a promise', async () => {
    const result = await run(`await new Promise(() => {}); return 1;`, { timeout: 300 });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TimeoutError');
    expect(result.error?.message).toMatch(/timed out after 300ms/);
  });

  it('times out a program stuck in a synchronous loop', async () => {
    const result = await run(`while (true) {}`, { timeout: 300 });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TimeoutError');
  });

  it('terminates a program that exceeds the memory limit', async () => {
    const result = await run(
      `
      const chunks = [];
      while (true) chunks.push(new Array(1024 * 1024).fill('x'));
      `,
      { transport: new IsolatedVmCodeModeTransport({ memoryLimitMb: 16 }), timeout: 30_000 },
    );
    expect(result.success).toBe(false);
  });

  it('preserves logs captured before a failure', async () => {
    const result = await run(`
      console.log('step 1 done');
      throw new Error('later failure');
    `);
    expect(result.success).toBe(false);
    expect(result.logs).toEqual(['step 1 done']);
  });

  it('returns an AbortError result without evaluating when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const dispatch = vi.fn(async () => 'ok');
    const result = await run(`return await external_ping({});`, {
      toolIds: ['ping'],
      dispatch,
      abortSignal: controller.signal,
    });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns an AbortError result when the signal aborts mid-run', async () => {
    const controller = new AbortController();
    const dispatch: CodeModeToolDispatcher = async () => {
      controller.abort();
      return new Promise(() => {});
    };
    const result = await run(`return await external_hang({});`, {
      toolIds: ['hang'],
      dispatch,
      abortSignal: controller.signal,
    });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
  });

  it('isolates the guest from host capabilities', async () => {
    const result = await run(`
      return {
        process: typeof process,
        require: typeof require,
        fetch: typeof fetch,
        setTimeout: typeof setTimeout,
      };
    `);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      process: 'undefined',
      require: 'undefined',
      fetch: 'undefined',
      setTimeout: 'undefined',
    });
  });

  it('invokes observer hooks and survives hooks that throw', async () => {
    const onExternalCall = vi.fn(() => {
      throw new Error('observer boom');
    });
    const onExternalResult = vi.fn();
    const result = await run(`return await external_ping({ q: 1 });`, {
      toolIds: ['ping'],
      dispatch: async () => 'pong',
      onExternalCall,
      onExternalResult,
    });
    expect(result.success).toBe(true);
    expect(result.result).toBe('pong');
    expect(onExternalCall).toHaveBeenCalledWith('ping', { q: 1 });
    expect(onExternalResult).toHaveBeenCalledWith('ping', expect.any(Number), undefined);
  });

  it('passes the dispatcher error to onExternalResult', async () => {
    const onExternalResult = vi.fn();
    await run(`try { await external_fail({}); } catch {} return null;`, {
      toolIds: ['fail'],
      dispatch: async () => {
        throw new Error('boom');
      },
      onExternalResult,
    });
    expect(onExternalResult).toHaveBeenCalledWith('fail', expect.any(Number), expect.any(Error));
    expect(onExternalResult.mock.calls[0]![2].message).toBe('boom');
  });

  it('reports a single error outcome when the dispatch result is not JSON-serializable', async () => {
    const onExternalResult = vi.fn();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = await run(`return await external_ping({});`, {
      toolIds: ['ping'],
      dispatch: async () => circular,
      onExternalResult,
    });
    expect(result.success).toBe(false);
    expect(onExternalResult).toHaveBeenCalledTimes(1);
    expect(onExternalResult.mock.calls[0]![2]).toBeInstanceOf(Error);
  });
});

describe('createCodeMode with IsolatedVmCodeModeTransport (no sandbox)', () => {
  // Minimal execution context the tool needs (observe + abortSignal).
  const ctx = () => ({
    observe: {
      span: async (_n: string, fn: () => any) => fn(),
      log: () => {},
    },
  });

  const getTopProducts = createTool({
    id: 'getTopProducts',
    description: 'Get top selling products',
    inputSchema: z.object({ limit: z.number() }),
    outputSchema: z.object({
      products: z.array(z.object({ id: z.string(), totalSales: z.number() })),
    }),
    execute: async ({ limit }) => ({
      products: Array.from({ length: limit }, (_, i) => ({ id: `p${i}`, totalSales: (i + 1) * 100 })),
    }),
  });

  it('runs end-to-end without a sandbox configured', async () => {
    const { tool } = createCodeMode({ tools: { getTopProducts } }, new IsolatedVmCodeModeTransport());
    const result: CodeModeToolResult = await (tool as any).execute(
      {
        code: `
          const top = await external_getTopProducts({ limit: 3 });
          return top.products.reduce((sum, p) => sum + p.totalSales, 0);
        `,
      },
      ctx(),
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe(600);
  });
});

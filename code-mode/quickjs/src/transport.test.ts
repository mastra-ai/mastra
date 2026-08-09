/**
 * Tests for {@link QuickJsCodeModeTransport}.
 *
 * These run against a real QuickJS WebAssembly interpreter, so they exercise the
 * actual isolation boundary: no fakes, no process spawning, no network. The
 * vitest config deliberately passes no `execArgv` — this transport must work
 * under a plain Node process, and these tests are the proof.
 *
 * The bulk of the suite is ported case-for-case from `@mastra/isolated-vm`'s
 * transport tests, because the two transports are meant to be interchangeable
 * and that file is the behavioural contract for a secure in-process transport.
 */

import { createCodeMode, createTool } from '@mastra/core/tools';
import type { CodeModeToolDispatcher, CodeModeToolResult } from '@mastra/core/tools';
import { DEBUG_SYNC, TestQuickJSWASMModule, newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { QuickJsCodeModeTransport } from './transport';

function run(
  program: string,
  overrides: Partial<{
    toolIds: string[];
    dispatch: CodeModeToolDispatcher;
    timeout: number;
    abortSignal: AbortSignal;
    onExternalCall: (tool: string, args: unknown) => void;
    onExternalResult: (tool: string, durationMs: number, error?: unknown) => void;
    transport: QuickJsCodeModeTransport;
  }> = {},
): Promise<CodeModeToolResult> {
  const transport = overrides.transport ?? new QuickJsCodeModeTransport();
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

describe('QuickJsCodeModeTransport', () => {
  it('declares that it does not require a sandbox', () => {
    expect(new QuickJsCodeModeTransport().requiresSandbox).toBe(false);
  });

  it('constructs and runs without any Node flags', async () => {
    // The reason this package exists: isolated-vm needs --no-node-snapshot on
    // Node 20+, and this process was started without it.
    expect(process.execArgv).not.toContain('--no-node-snapshot');
    expect(process.env.NODE_OPTIONS ?? '').not.toContain('--no-node-snapshot');
    await expect(run(`return 'ok';`)).resolves.toMatchObject({ success: true, result: 'ok' });
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

  it('keeps many concurrent external_* calls in flight at once', async () => {
    // Guards the core reason this transport uses the synchronous build: the
    // asyncify build can only suspend for one host call at a time.
    let inFlight = 0;
    let maxInFlight = 0;
    const dispatch: CodeModeToolDispatcher = async (_tool, args) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 10));
      inFlight--;
      return (args as { n: number }).n;
    };
    const result = await run(
      `
      const calls = [];
      for (let n = 0; n < 8; n++) calls.push(external_calc({ n }));
      return (await Promise.all(calls)).reduce((a, b) => a + b, 0);
      `,
      { toolIds: ['calc'], dispatch },
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe(28);
    expect(maxInFlight).toBe(8);
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

  it('times out a program that hangs waiting on an external_* call', async () => {
    const result = await run(`return await external_hang({});`, {
      toolIds: ['hang'],
      dispatch: () => new Promise(() => {}),
      timeout: 300,
    });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TimeoutError');
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
      { transport: new QuickJsCodeModeTransport({ memoryLimitMb: 16 }), timeout: 30_000 },
    );
    expect(result.success).toBe(false);
    // A 30s timeout would also fail this program, so assert the limit is what
    // stopped it. Otherwise the test would still pass if memoryLimitMb were ignored.
    expect(result.error?.name).not.toBe('TimeoutError');
    expect(result.error?.message).toMatch(/out of memory/i);
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

  it('stops a runaway synchronous loop promptly once the signal aborts', async () => {
    // A blocking guest loop cannot be interrupted from the host event loop, so
    // the interrupt handler is what makes an abort effective: here the signal
    // fires during a dispatch, and the loop the guest enters next must unwind
    // immediately instead of burning CPU until the timeout.
    const controller = new AbortController();
    const started = Date.now();
    const result = await run(`await external_go({}); while (true) {}`, {
      toolIds: ['go'],
      dispatch: async () => {
        controller.abort();
        return 'go';
      },
      abortSignal: controller.signal,
      timeout: 30_000,
    });
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
    expect(Date.now() - started).toBeLessThan(5_000);
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

  it('does not expose the host bridges or a module loader to the guest', async () => {
    // The security claim of this package, asserted rather than assumed.
    const result = await run(`
      return {
        hostCall: typeof globalThis.__hostCall,
        hostLog: typeof globalThis.__hostLog,
        importScripts: typeof importScripts,
        module: typeof module,
        globalProcess: typeof globalThis.process,
      };
    `);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      hostCall: 'undefined',
      hostLog: 'undefined',
      importScripts: 'undefined',
      module: 'undefined',
      globalProcess: 'undefined',
    });
  });

  it('never reaches the dispatcher for a tool that was not exposed', async () => {
    const dispatch = vi.fn(async () => 'ok');
    const result = await run(
      `
      try {
        return await external_secret({});
      } catch (e) {
        return { name: e.name };
      }
      `,
      { toolIds: ['allowed'], dispatch },
    );
    // Only allow-listed tools get an `external_*` global, so an unexposed tool
    // is not callable at all — the guest cannot even name the host bridge.
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ name: 'ReferenceError' });
    expect(dispatch).not.toHaveBeenCalled();
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

describe('QuickJsCodeModeTransport handle disposal', () => {
  /**
   * QuickJS handles are freed by hand, and a single undisposed one aborts the
   * whole WASM module when the runtime is freed — which in a long-running agent
   * process is a slow, hard-to-attribute memory bug. The debug build ships a
   * leak sanitizer, so assert against it directly rather than trusting review.
   */
  async function expectNoLeaks(exercise: (transport: QuickJsCodeModeTransport) => Promise<unknown>) {
    const wasm = await newQuickJSWASMModuleFromVariant(DEBUG_SYNC);
    const sanitizer = new TestQuickJSWASMModule(wasm);
    await exercise(new QuickJsCodeModeTransport({ module: wasm }));
    expect(() => sanitizer.assertNoMemoryAllocated()).not.toThrow();
  }

  it('leaves nothing allocated after a successful run', async () => {
    await expectNoLeaks(async transport => {
      const result = await run(`console.log('hi'); return await external_ping({ a: 1 });`, {
        transport,
        toolIds: ['ping'],
        dispatch: async () => ({ ok: true }),
      });
      expect(result.success).toBe(true);
    });
  });

  it('leaves nothing allocated after a failing run', async () => {
    await expectNoLeaks(async transport => {
      const result = await run(`throw new Error('nope');`, { transport });
      expect(result.success).toBe(false);
    });
  });

  it('leaves nothing allocated when a dispatch is still in flight at timeout', async () => {
    // The hard case: a deferred promise the host never settles.
    await expectNoLeaks(async transport => {
      const result = await run(`return await external_hang({});`, {
        transport,
        toolIds: ['hang'],
        dispatch: () => new Promise(() => {}),
        timeout: 200,
      });
      expect(result.error?.name).toBe('TimeoutError');
      // Give the abandoned dispatch a chance to settle against a freed context.
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });

  it('leaves nothing allocated after a synchronous-loop timeout', async () => {
    await expectNoLeaks(async transport => {
      const result = await run(`while (true) {}`, { transport, timeout: 200 });
      expect(result.error?.name).toBe('TimeoutError');
    });
  });
});

describe('createCodeMode with QuickJsCodeModeTransport (no sandbox)', () => {
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
    const { tool } = createCodeMode({ tools: { getTopProducts } }, new QuickJsCodeModeTransport());
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

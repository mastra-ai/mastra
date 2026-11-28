import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../tool';
import { createCodeMode } from './code-mode';
import type { CodeModeToolResult, CodeModeTransport } from './types';

// Minimal execution context the tool needs (observe + abortSignal).
const ctx = (overrides: Record<string, unknown> = {}) => ({
  observe: {
    span: async (_n: string, fn: () => any) => fn(),
    log: () => {},
  },
  ...overrides,
});

function run(tool: any, code: string, context = ctx()): Promise<CodeModeToolResult> {
  return tool.execute({ code }, context);
}

/**
 * A sandbox-free transport whose behavior is scripted by the test. It receives
 * the same `run` options a real transport would and never leaves the process.
 */
function scripted(
  handler: (opts: Parameters<CodeModeTransport['run']>[0]) => Promise<CodeModeToolResult>,
): CodeModeTransport {
  return { requiresSandbox: false, run: handler };
}

const pingTool = () =>
  createTool({
    id: 'ping',
    description: 'ping',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async () => ({ ok: true }),
  });

describe('createCodeMode limits — validation', () => {
  const transport = scripted(async () => ({ success: true, logs: [] }));

  it('rejects non-integer or below-minimum limits before running any code', () => {
    const cases: Array<[string, number]> = [
      ['maxCalls', 0],
      ['maxCalls', 1.5],
      ['maxConcurrentCalls', 0],
      ['maxResultBytes', -1],
      ['maxLogBytes', -1],
      ['maxLogLines', -1],
    ];
    for (const [option, value] of cases) {
      expect(() => createCodeMode({ tools: { ping: pingTool() }, [option]: value }, transport)).toThrow(RangeError);
      expect(() => createCodeMode({ tools: { ping: pingTool() }, [option]: value }, transport)).toThrow(
        new RegExp(option),
      );
    }
  });

  it('accepts 0 for the byte and line caps', () => {
    expect(() =>
      createCodeMode({ tools: { ping: pingTool() }, maxLogBytes: 0, maxLogLines: 0, maxResultBytes: 0 }, transport),
    ).not.toThrow();
  });
});

describe('createCodeMode limits — maxCalls', () => {
  it('counts every dispatch attempt and fails the run even when the guest catches it', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const spy = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute,
    });

    const transport = scripted(async opts => {
      await opts.dispatch('ping', {});
      // The guest swallows the rejection; the run must still fail.
      try {
        await opts.dispatch('ping', {});
      } catch {
        // ignore
      }
      return { success: true, result: 'survived', logs: ['guest saw an error'] };
    });

    const { tool } = createCodeMode({ tools: { ping: spy }, maxCalls: 1 }, transport);
    const result = await run(tool, 'ignored');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('CodeModeLimitError');
    expect(result.error?.message).toContain('maxCalls');
    expect(result.logs).toEqual(['guest saw an error']);
  });

  it('counts attempts against unavailable tools so the budget cannot be bypassed', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const ping = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute,
    });

    const transport = scripted(async opts => {
      // A failed call to a missing tool still spends the budget, so a guest
      // cannot probe for free and then get one real call past maxCalls: 1.
      try {
        await opts.dispatch('ghost', {});
      } catch {
        /* the guest swallows the "not available" error */
      }
      try {
        await opts.dispatch('ping', {});
      } catch {
        /* rejected because the ghost attempt already used the one call */
      }
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { ping }, maxCalls: 1 }, transport);
    const result = await run(tool, 'ignored');

    expect(execute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('CodeModeLimitError');
    expect(result.error?.message).toContain('maxCalls');
  });

  it('allows exactly maxCalls dispatches and fails the next attempt', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const spy = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute,
    });

    let thirdFailed = false;
    const transport = scripted(async opts => {
      await opts.dispatch('ping', {});
      await opts.dispatch('ping', {});
      try {
        await opts.dispatch('ping', {});
      } catch {
        thirdFailed = true;
      }
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { ping: spy }, maxCalls: 2 }, transport);
    const result = await run(tool, 'ignored');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(thirdFailed).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('CodeModeLimitError');
  });
});

describe('createCodeMode limits — maxConcurrentCalls', () => {
  it.each([1, 2, 3])('never exceeds a cap of %i concurrent nested calls', async cap => {
    let active = 0;
    let peak = 0;
    const spy = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return { ok: true };
      },
    });

    const transport = scripted(async opts => {
      await Promise.all(Array.from({ length: 5 }, () => opts.dispatch('ping', {})));
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { ping: spy }, maxConcurrentCalls: cap }, transport);
    const result = await run(tool, 'ignored');

    expect(result.success).toBe(true);
    expect(peak).toBe(cap);
  });

  it('runs every call at once when the cap is above the number of calls', async () => {
    let active = 0;
    let peak = 0;
    const spy = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return { ok: true };
      },
    });

    const transport = scripted(async opts => {
      await Promise.all([opts.dispatch('ping', {}), opts.dispatch('ping', {}), opts.dispatch('ping', {})]);
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { ping: spy }, maxConcurrentCalls: 8 }, transport);
    await run(tool, 'ignored');

    expect(peak).toBe(3);
  });

  it('queues a very large backlog without quadratic slowdown', async () => {
    let active = 0;
    let peak = 0;
    // Records the order calls actually start, to confirm FIFO is preserved.
    const started: number[] = [];
    const spy = createTool({
      id: 'ping',
      description: 'ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        started.push(started.length);
        active -= 1;
        return { ok: true };
      },
    });

    const backlog = 200_000;
    const transport = scripted(async opts => {
      await Promise.all(Array.from({ length: backlog }, () => opts.dispatch('ping', {})));
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { ping: spy }, maxConcurrentCalls: 2 }, transport);
    const startedAt = Date.now();
    const result = await run(tool, 'ignored');
    const durationMs = Date.now() - startedAt;
    expect(result.success).toBe(true);
    expect(peak).toBeLessThanOrEqual(2);
    expect(started).toHaveLength(backlog);
    expect(started[0]).toBe(0);
    expect(started[backlog - 1]).toBe(backlog - 1);
    // Guards against per-call work that grows with the queue (e.g. one abort
    // listener per waiter): quadratic dequeue takes minutes at this size.
    expect(durationMs).toBeLessThan(8_000);
  }, 20_000);
});

describe('createCodeMode limits — maxResultBytes', () => {
  it('fails the run when a nested tool result exceeds the cap', async () => {
    const big = createTool({
      id: 'big',
      description: 'big',
      inputSchema: z.object({ size: z.number() }),
      outputSchema: z.any(),
      execute: async ({ size }) => ({ blob: 'x'.repeat(size) }),
    });

    const transport = scripted(async opts => {
      try {
        await opts.dispatch('big', { size: 5_000 });
      } catch {
        // ignore: guest catches the rejection
      }
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { big }, maxResultBytes: 100 }, transport);
    const result = await run(tool, 'ignored');

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('CodeModeLimitError');
    expect(result.error?.message).toContain('maxResultBytes');
  });

  it('passes results within the cap through to the transport', async () => {
    const small = createTool({
      id: 'small',
      description: 'small',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const transport = scripted(async opts => {
      const value = await opts.dispatch('small', {});
      return { success: true, result: value, logs: [] };
    });
    const { tool } = createCodeMode({ tools: { small }, maxResultBytes: 100 }, transport);
    const result = await run(tool, 'ignored');
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ ok: true });
  });

  it('is a strict byte boundary: exactly at the cap passes, one byte under fails', async () => {
    const blob = createTool({
      id: 'blob',
      description: 'blob',
      inputSchema: z.object({ size: z.number() }),
      outputSchema: z.any(),
      execute: async ({ size }) => ({ blob: 'x'.repeat(size) }),
    });
    const bytesOf = (size: number) => new TextEncoder().encode(JSON.stringify({ blob: 'x'.repeat(size) })).length;

    const dispatchWithCap = async (cap: number) => {
      const transport = scripted(async opts => {
        try {
          await opts.dispatch('blob', { size: 32 });
        } catch {
          /* guest swallows the rejection */
        }
        return { success: true, logs: [] };
      });
      const { tool } = createCodeMode({ tools: { blob }, maxResultBytes: cap }, transport);
      return run(tool, 'ignored');
    };

    const cap = bytesOf(32);
    expect((await dispatchWithCap(cap)).success).toBe(true);
    expect((await dispatchWithCap(cap - 1)).success).toBe(false);
  });
});

describe('createCodeMode run-scoped cancellation', () => {
  it('forwards the outer abort signal to the transport', async () => {
    let seen: AbortSignal | undefined;
    const transport = scripted(async opts => {
      seen = opts.abortSignal;
      await new Promise<void>(resolve => {
        if (opts.abortSignal?.aborted) return resolve();
        opts.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
      });
      return { success: false, logs: [], error: { message: 'aborted', name: 'AbortError' } };
    });

    const controller = new AbortController();
    const { tool } = createCodeMode({ tools: { ping: pingTool() } }, transport);
    const pending = run(tool, 'ignored', ctx({ abortSignal: controller.signal }));
    controller.abort(new Error('user stopped'));

    const result = await pending;
    expect(result.success).toBe(false);
    expect(seen).toBeDefined();
  });

  it('aborts leftover nested work once the transport finishes', async () => {
    let nestedSignal: AbortSignal | undefined;
    const slow = createTool({
      id: 'slow',
      description: 'slow',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async (_input, context: any) => {
        nestedSignal = context.abortSignal;
        return { ok: true };
      },
    });

    const transport = scripted(async opts => {
      await opts.dispatch('slow', {});
      return { success: true, logs: [] };
    });

    const { tool } = createCodeMode({ tools: { slow } }, transport);
    await run(tool, 'ignored');

    expect(nestedSignal).toBeDefined();
    expect(nestedSignal?.aborted).toBe(true);
  });

  it('rejects calls still queued when the run is aborted, without starting them', async () => {
    let started = 0;
    const slow = createTool({
      id: 'slow',
      description: 'slow',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => {
        started += 1;
        await new Promise(resolve => setTimeout(resolve, 200));
        return { ok: true };
      },
    });

    const controller = new AbortController();
    const settled: Array<'ok' | Error> = [];
    const transport = scripted(async opts => {
      const calls = Array.from({ length: 6 }, () =>
        opts.dispatch('slow', {}).then(
          () => settled.push('ok'),
          (error: unknown) => settled.push(error instanceof Error ? error : new Error(String(error))),
        ),
      );
      // Let one call start, then abort while the remaining five sit in the queue.
      await new Promise(resolve => setTimeout(resolve, 10));
      controller.abort(new Error('user stopped'));
      await Promise.all(calls);
      return { success: false, logs: [], error: { message: 'aborted', name: 'AbortError' } };
    });

    const { tool } = createCodeMode({ tools: { slow }, maxConcurrentCalls: 1 }, transport);
    await run(tool, 'ignored', ctx({ abortSignal: controller.signal }));

    expect(started).toBe(1);
    expect(settled.filter(result => result === 'ok')).toHaveLength(1);
    expect(settled.filter(result => result instanceof Error)).toHaveLength(5);
  });
});

describe('createCodeMode log caps — core replay guard', () => {
  it('forwards the caps to the transport', async () => {
    let seen: { maxLogBytes?: number; maxLogLines?: number } = {};
    const transport = scripted(async opts => {
      seen = { maxLogBytes: opts.maxLogBytes, maxLogLines: opts.maxLogLines };
      return { success: true, logs: [] };
    });
    const { tool } = createCodeMode({ tools: { ping: pingTool() }, maxLogBytes: 64, maxLogLines: 3 }, transport);
    await run(tool, 'ignored');
    expect(seen).toEqual({ maxLogBytes: 64, maxLogLines: 3 });
  });

  it('truncates a custom transport’s over-cap logs and appends the marker', async () => {
    const transport = scripted(async () => ({ success: true, logs: ['a', 'b', 'c', 'd'] }));
    const { tool } = createCodeMode({ tools: { ping: pingTool() }, maxLogLines: 2 }, transport);
    const result = await run(tool, 'ignored');
    expect(result.success).toBe(true);
    expect(result.logs).toEqual(['a', '[code mode logs truncated]']);
  });

  it('captures nothing when a cap is 0', async () => {
    const transport = scripted(async () => ({ success: true, logs: ['a', 'b'] }));
    const { tool } = createCodeMode({ tools: { ping: pingTool() }, maxLogLines: 0 }, transport);
    const result = await run(tool, 'ignored');
    expect(result.logs).toEqual([]);
  });

  it('leaves logs untouched when no cap is configured', async () => {
    const transport = scripted(async () => ({ success: true, logs: ['a', 'b', 'c'] }));
    const { tool } = createCodeMode({ tools: { ping: pingTool() } }, transport);
    const result = await run(tool, 'ignored');
    expect(result.logs).toEqual(['a', 'b', 'c']);
  });
});

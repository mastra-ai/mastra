/**
 * Regression test for the resolver-registration bug introduced in #15072.
 *
 * #15072 split the AsyncLocalStorage-backed `getCurrentSpan` out of
 * `observability/utils.ts` into `observability/context-storage.ts`, and made
 * `utils.resolveCurrentSpan()` look up the resolver via a slot that's
 * populated when `initContextStorage()` is called.
 *
 * The fix is an explicit `initContextStorage()` call in the `Mastra`
 * constructor (rather than a side-effect import that gets tree-shaken by tsup).
 *
 * This test instantiates `Mastra` and verifies that the constructor-triggered
 * registration makes `resolveCurrentSpan()` work inside `executeWithContext`.
 */
import { describe, it, expect, vi } from 'vitest';
import { Mastra } from '../mastra';
import { EntityType, SpanType } from './types';
import { executeWithContext, getOrCreateSpan, resolveCurrentSpan } from './utils';

// Instantiate Mastra — this is the production path that triggers initContextStorage().
new Mastra();

describe('context-storage resolver registration (regression for #15072)', () => {
  it('resolveCurrentSpan returns the active span inside executeWithContext after Mastra is constructed', async () => {
    const span = { id: 'test-span', traceId: 'test-trace' } as any;

    let resolved: unknown;
    await executeWithContext({
      span,
      fn: async () => {
        resolved = resolveCurrentSpan();
      },
    });

    expect(resolved).toBe(span);
  });

  it('resolveCurrentSpan returns undefined outside any executeWithContext scope', () => {
    expect(resolveCurrentSpan()).toBeUndefined();
  });

  it('getOrCreateSpan creates a child of the ambient span inside executeWithContext', async () => {
    const childSpan = { id: 'child-span', traceId: 'test-trace' };
    const parentSpan = {
      id: 'parent-span',
      traceId: 'test-trace',
      createChildSpan: vi.fn().mockReturnValue(childSpan),
    } as any;

    let resolved: unknown;
    await executeWithContext({
      span: parentSpan,
      fn: async () => {
        resolved = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: "agent run: 'test-agent'",
          entityType: EntityType.AGENT,
          entityId: 'test-agent',
          mastra: {
            observability: {
              getSelectedInstance: vi.fn(),
            },
          } as any,
        });
      },
    });

    expect(resolved).toBe(childSpan);
    expect(parentSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.AGENT_RUN,
        name: "agent run: 'test-agent'",
        entityType: EntityType.AGENT,
        entityId: 'test-agent',
      }),
    );
  });

  it('getOrCreateSpan preserves explicit tracingOptions over the ambient span', async () => {
    const parentSpan = {
      id: 'parent-span',
      traceId: 'ambient-trace',
      createChildSpan: vi.fn(),
    } as any;
    const rootSpan = { id: 'root-span', traceId: 'explicit-trace' };
    const startSpan = vi.fn().mockReturnValue(rootSpan);

    let resolved: unknown;
    await executeWithContext({
      span: parentSpan,
      fn: async () => {
        resolved = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: "agent run: 'test-agent'",
          entityType: EntityType.AGENT,
          entityId: 'test-agent',
          tracingOptions: { traceId: 'explicit-trace' },
          mastra: {
            observability: {
              getSelectedInstance: vi.fn().mockReturnValue({ startSpan }),
            },
          } as any,
        });
      },
    });

    expect(resolved).toBe(rootSpan);
    expect(parentSpan.createChildSpan).not.toHaveBeenCalled();
    expect(startSpan).toHaveBeenCalledWith(expect.objectContaining({ traceId: 'explicit-trace' }));
  });
});

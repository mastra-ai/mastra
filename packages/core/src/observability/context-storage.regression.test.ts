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
import { describe, it, expect } from 'vitest';
import { Mastra } from '../mastra';
import { executeWithContext, resolveCurrentSpan } from './utils';

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
});

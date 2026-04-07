/**
 * Regression test for the resolver-registration bug introduced in #15072.
 *
 * #15072 split the AsyncLocalStorage-backed `getCurrentSpan` out of
 * `observability/utils.ts` into `observability/context-storage.ts`, and made
 * `utils.resolveCurrentSpan()` look up the resolver via a slot that's
 * populated as a side effect when `context-storage.ts` is imported.
 *
 * Nothing in production code was importing `context-storage.ts`, so the side
 * effect never ran in real apps. The result: `DualLogger` always saw
 * `resolveCurrentSpan() === undefined`, fell back to the global uncorrelated
 * `loggerVNext`, and every log emitted from inside an agent run lost its
 * `correlationContext` (entityId/runId/traceId/etc were all `null` in
 * storage).
 *
 * The fix is a side-effect import in the server-only `Mastra` class
 * (`packages/core/src/mastra/index.ts`), which guarantees the resolver is
 * registered before any agent executes.
 *
 * This test imports `../mastra` (which transitively triggers the registration)
 * and then verifies that `resolveCurrentSpan()` actually returns the active
 * span when called from inside `executeWithContext`.
 */
import { describe, it, expect } from 'vitest';
// Importing Mastra runs the side-effect import of context-storage.
import '../mastra';
import { executeWithContext, resolveCurrentSpan } from './utils';

describe('context-storage resolver registration (regression for #15072)', () => {
  it('resolveCurrentSpan returns the active span inside executeWithContext after Mastra is loaded', async () => {
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

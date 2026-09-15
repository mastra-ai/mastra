import { describe, expect, it, vi } from 'vitest';

import type { ScoringHookInput } from '../evals/types';
import type { Mastra } from '../mastra';
import { wrapMastra } from '../observability/context';
import { isScorerHookForMastra, setScorerHookOwner } from './scorer-owner';

/**
 * Scorer hook ownership is scoped to the emitting Mastra instance (#20839).
 * Tracing wraps Mastra in a Proxy, which is a distinct object identity from its
 * target, so durable scorer dispatch — which receives the step-context proxy —
 * used to mint a token the real instance's hook never matched, silently dropping
 * every live score (#23465). Ownership must therefore resolve through the
 * tracing wrapper while genuinely distinct instances stay isolated.
 */

function makeMockMastra() {
  return {
    getAgent: vi.fn(),
    getAgentById: vi.fn(),
    getWorkflow: vi.fn(),
    getWorkflowById: vi.fn(),
  };
}

/** A valid, non-NoOp span so `wrapMastra` actually creates a proxy. */
function makeTracingContext() {
  return { currentSpan: { id: 'step-span', traceId: 'trace-1', isValid: true } } as any;
}

function makeHookData(): ScoringHookInput {
  return { runId: 'run-1', scorerId: 'scorer-1' } as unknown as ScoringHookInput;
}

describe('scorer owner tokens', () => {
  it('accepts a score dispatched through a tracing proxy of the owning Mastra', () => {
    const mastra = makeMockMastra() as unknown as Mastra;
    const proxy = wrapMastra(mastra, makeTracingContext());

    // The proxy must actually be a distinct identity, otherwise this proves nothing.
    expect(proxy).not.toBe(mastra);

    const data = makeHookData();
    setScorerHookOwner(data, proxy);

    expect(isScorerHookForMastra(data, mastra)).toBe(true);
    expect(isScorerHookForMastra(data, proxy)).toBe(true);
  });

  it('accepts a score dispatched through a nested tracing proxy', () => {
    // A tool executed inside a traced workflow step receives an already-wrapped
    // mastra, and tool-builder wraps it again.
    const mastra = makeMockMastra() as unknown as Mastra;
    const once = wrapMastra(mastra, makeTracingContext());
    const twice = wrapMastra(once as any, makeTracingContext());

    expect(twice).not.toBe(once);

    const data = makeHookData();
    setScorerHookOwner(data, twice as unknown as Mastra);

    expect(isScorerHookForMastra(data, mastra)).toBe(true);
    expect(isScorerHookForMastra(data, once as unknown as Mastra)).toBe(true);
  });

  it('still rejects a genuinely different Mastra instance', () => {
    // The guarantee from #20839: a Mastra must not handle another Mastra's scores.
    const mastraA = makeMockMastra() as unknown as Mastra;
    const mastraB = makeMockMastra() as unknown as Mastra;

    const data = makeHookData();
    setScorerHookOwner(data, mastraA);

    expect(isScorerHookForMastra(data, mastraA)).toBe(true);
    expect(isScorerHookForMastra(data, mastraB)).toBe(false);
  });

  it('still rejects a different Mastra even when both are tracing proxies', () => {
    const mastraA = makeMockMastra() as unknown as Mastra;
    const mastraB = makeMockMastra() as unknown as Mastra;
    const proxyA = wrapMastra(mastraA, makeTracingContext());
    const proxyB = wrapMastra(mastraB, makeTracingContext());

    const data = makeHookData();
    setScorerHookOwner(data, proxyA as unknown as Mastra);

    expect(isScorerHookForMastra(data, proxyB as unknown as Mastra)).toBe(false);
    expect(isScorerHookForMastra(data, mastraB)).toBe(false);
  });

  it('broadcasts a payload that has no owner', () => {
    // Hooks dispatched through the public executeHook API carry no owner.
    const data = makeHookData();

    expect(isScorerHookForMastra(data, makeMockMastra() as unknown as Mastra)).toBe(true);
  });

  it('broadcasts again once ownership is cleared', () => {
    const mastra = makeMockMastra() as unknown as Mastra;
    const other = makeMockMastra() as unknown as Mastra;

    const data = makeHookData();
    setScorerHookOwner(data, mastra);
    expect(isScorerHookForMastra(data, other)).toBe(false);

    setScorerHookOwner(data, undefined);
    expect(isScorerHookForMastra(data, other)).toBe(true);
  });

  it('reuses one token for an instance and its proxy', () => {
    const mastra = makeMockMastra() as unknown as Mastra;
    const proxy = wrapMastra(mastra, makeTracingContext());

    const viaProxy = makeHookData();
    setScorerHookOwner(viaProxy, proxy as unknown as Mastra);

    const viaInstance = makeHookData();
    setScorerHookOwner(viaInstance, mastra);

    // Ownership set through either path is accepted by the other.
    expect(isScorerHookForMastra(viaProxy, mastra)).toBe(true);
    expect(isScorerHookForMastra(viaInstance, proxy as unknown as Mastra)).toBe(true);
  });

  it('does not wrap when there is no current span, and still matches', () => {
    const mastra = makeMockMastra() as unknown as Mastra;
    const unwrapped = wrapMastra(mastra, {} as any);

    expect(unwrapped).toBe(mastra);

    const data = makeHookData();
    setScorerHookOwner(data, unwrapped as unknown as Mastra);

    expect(isScorerHookForMastra(data, mastra)).toBe(true);
  });
});

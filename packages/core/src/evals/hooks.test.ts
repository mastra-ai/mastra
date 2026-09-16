import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailableHooks } from '../hooks';
import type { ObservabilityContext } from '../observability';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../request-context';
import type { MastraScorerEntry } from './base';
import { hashToUnitInterval, runScorer } from './hooks';
import type { ScoringHookInput } from './types';

vi.mock('../hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks')>();
  return {
    ...actual,
    executeHook: vi.fn(),
  };
});

const { executeHook } = await import('../hooks');
const executeHookMock = vi.mocked(executeHook);

beforeEach(() => {
  executeHookMock.mockClear();
});

function lastPayload(): ScoringHookInput {
  const calls = executeHookMock.mock.calls;
  return calls[calls.length - 1]![1] as ScoringHookInput;
}

function baseArgs(requestContext: Record<string, any>) {
  return {
    runId: 'run-1',
    scorerId: 'scorer-1',
    scorerObject: {
      scorer: { id: 'scorer-1', name: 'Scorer', description: 'test scorer' },
    } as any,
    input: {},
    output: {},
    requestContext,
    entity: { id: 'agent-1' },
    structuredOutput: false,
    source: 'LIVE' as const,
    entityType: 'AGENT' as const,
    tracing: undefined,
    loggerVNext: undefined,
    metrics: undefined,
    tracingContext: undefined,
  } as unknown as Parameters<typeof runScorer>[0];
}

describe('runScorer requestContext flattening', () => {
  it('keeps primitive entries, including nested ones', () => {
    runScorer(baseArgs({ userId: 'u1', tenant: { id: 't1' } }));

    expect(lastPayload().requestContext).toEqual({ userId: 'u1', 'tenant.id': 't1' });
  });

  it('excludes the framework-managed auth token from the persisted payload', () => {
    const ctx = new RequestContext([
      ['userId', 'u1'],
      [MASTRA_AUTH_TOKEN_KEY, 'super-secret-bearer-token'],
    ]);

    runScorer(baseArgs(ctx as any));

    const persisted = lastPayload().requestContext;
    expect(persisted).toEqual({ userId: 'u1' });
    expect(JSON.stringify(persisted)).not.toContain('super-secret-bearer-token');
  });
});

function makeScorer(sampling?: MastraScorerEntry['sampling'], filter?: MastraScorerEntry['filter']): MastraScorerEntry {
  return {
    scorer: { id: 'scorer-1', name: 'scorer-1', description: 'test scorer' },
    sampling,
    filter,
  } as unknown as MastraScorerEntry;
}

/**
 * Minimal stand-in for a span. Only `isValid` and `traceId` are read by the sampling path.
 * `isValid: false` models a NoOpSpan (tracer declined); omitting the span entirely models
 * observability not being configured.
 */
function makeObservabilityContext(span?: { isValid: boolean; traceId: string }): ObservabilityContext {
  return { tracing: { currentSpan: span } } as unknown as ObservabilityContext;
}

function invoke({
  sampling,
  filter,
  span,
  runId = 'run-1',
  requestContext = {},
}: {
  sampling?: MastraScorerEntry['sampling'];
  filter?: MastraScorerEntry['filter'];
  span?: { isValid: boolean; traceId: string };
  runId?: string;
  requestContext?: Record<string, any>;
}) {
  runScorer({
    runId,
    scorerId: 'scorer-1',
    scorerObject: makeScorer(sampling, filter),
    input: {},
    output: {},
    requestContext,
    entity: {},
    structuredOutput: false,
    source: 'LIVE',
    entityType: 'AGENT',
    ...makeObservabilityContext(span),
  } as Parameters<typeof runScorer>[0]);
}

function didScore(args: Parameters<typeof invoke>[0]): boolean {
  executeHookMock.mockClear();
  invoke(args);
  return executeHookMock.mock.calls.some(call => call[0] === AvailableHooks.ON_SCORER_RUN);
}

async function didScoreAfterSampling(args: Parameters<typeof invoke>[0]): Promise<boolean> {
  executeHookMock.mockClear();
  await runScorer({
    runId: args.runId ?? 'run-1',
    scorerId: 'scorer-1',
    scorerObject: makeScorer(args.sampling, args.filter),
    input: {},
    output: {},
    requestContext: args.requestContext ?? {},
    entity: {},
    structuredOutput: false,
    source: 'LIVE',
    entityType: 'AGENT',
    ...makeObservabilityContext(args.span),
  } as Parameters<typeof runScorer>[0]);
  return executeHookMock.mock.calls.some(call => call[0] === AvailableHooks.ON_SCORER_RUN);
}

/** OTel trace IDs are 32 hex chars. Sequential synthetic IDs would mask a biased hash. */
function makeTraceIds(count: number): string[] {
  return Array.from({ length: count }, () => globalThis.crypto.randomUUID().replace(/-/g, ''));
}

function validSpan(traceId: string) {
  return { isValid: true, traceId };
}

describe('runScorer sampling', () => {
  describe('sampling config passthrough', () => {
    it('always executes when sampling is absent', () => {
      expect(didScore({ span: validSpan(makeTraceIds(1)[0]!) })).toBe(true);
    });

    it("always executes when sampling type is 'none'", () => {
      expect(didScore({ sampling: { type: 'none' }, span: validSpan(makeTraceIds(1)[0]!) })).toBe(true);
    });
  });

  describe('C2: trace sampling lineage', () => {
    it('does not score when the tracer declined the trace, even at rate 1', () => {
      expect(
        didScore({
          sampling: { type: 'ratio', rate: 1 },
          span: { isValid: false, traceId: 'no-op-trace' },
        }),
      ).toBe(false);
    });

    it('does not score a declined trace even when sampling is absent', () => {
      expect(didScore({ span: { isValid: false, traceId: 'no-op-trace' } })).toBe(false);
    });

    it('scores normally when observability is not configured (no span present)', async () => {
      // Largest population of users: an absent span is not a decline. If this ever fails,
      // scoring has been silently disabled for everyone without observability configured.
      expect(await didScoreAfterSampling({ sampling: { type: 'ratio', rate: 1 } })).toBe(true);
    });

    it('declined traces never reach the hash, so they do not sample all-or-nothing', () => {
      // Every NoOpSpan shares the constant traceId 'no-op-trace'. If the validity check were
      // reordered after the hash, that single key would decide for the entire declined
      // population at once — every declined trace scored, or none, depending on the rate.
      const scoredAtHalf = didScore({
        sampling: { type: 'ratio', rate: 0.5 },
        span: { isValid: false, traceId: 'no-op-trace' },
      });
      const scoredAtNearOne = didScore({
        sampling: { type: 'ratio', rate: 0.999 },
        span: { isValid: false, traceId: 'no-op-trace' },
      });
      expect(scoredAtHalf).toBe(false);
      expect(scoredAtNearOne).toBe(false);
    });
  });

  describe('C1: deterministic sampling', () => {
    it('returns the same decision for the same trace across repeated invocations', async () => {
      const traceId = makeTraceIds(1)[0]!;
      const decisions = new Set(
        (await Promise.all(Array.from({ length: 50 }, () => hashToUnitInterval(traceId)))).map(value => value < 0.5),
      );
      expect(decisions.size).toBe(1);
    });

    it.each([0.01, 0.1, 0.5, 0.9])('samples approximately rate %s of traces', async rate => {
      // The core risk of this change: a biased hash silently shifts the effective sampling
      // rate with nothing downstream to surface it.
      const values = await Promise.all(makeTraceIds(4000).map(hashToUnitInterval));
      const sampled = values.filter(value => value < rate).length;
      // Binomial-derived bound (6 sigma): tight enough that an always-false or always-true
      // sampler fails at every rate, loose enough to never flake on an unbiased hash.
      const expected = values.length * rate;
      const tolerance = Math.max(10, 6 * Math.sqrt(values.length * rate * (1 - rate)));
      expect(sampled).toBeGreaterThan(expected - tolerance);
      expect(sampled).toBeLessThan(expected + tolerance);
    });

    it('co-samples and nests lower rates within higher rates', async () => {
      const traceIds = makeTraceIds(500);
      const values = await Promise.all(traceIds.map(hashToUnitInterval));
      const first = traceIds.filter((_, index) => values[index]! < 0.1);
      const second = traceIds.filter((_, index) => values[index]! < 0.1);
      const wide = new Set(traceIds.filter((_, index) => values[index]! < 0.2));
      const narrow = traceIds.filter((_, index) => values[index]! < 0.05);

      expect(first.length).toBeGreaterThan(0);
      expect(second).toEqual(first);
      expect(narrow.length).toBeGreaterThan(0);
      expect(narrow.length).toBeLessThan(wide.size);
      expect(narrow.every(traceId => wide.has(traceId))).toBe(true);
    });

    it('never samples at rate 0 and always samples at rate 1', async () => {
      const values = await Promise.all(makeTraceIds(200).map(hashToUnitInterval));
      expect(values.some(value => value < 0)).toBe(false);
      expect(values.every(value => value < 1)).toBe(true);
    });
  });
});

describe('runScorer eligibility filter', () => {
  const matchAll = { op: 'exists', path: 'source' } as const;
  const matchNone = { op: 'eq', left: { path: 'requestContext.tier' }, right: { literal: 'pro' } } as const;

  it('scores when the filter matches', () => {
    expect(didScore({ filter: matchAll })).toBe(true);
    expect(didScore({ filter: matchNone, requestContext: { tier: 'pro' } })).toBe(true);
  });

  it('skips scoring when the filter does not match (fail closed)', () => {
    expect(didScore({ filter: matchNone })).toBe(false);
    expect(didScore({ filter: matchNone, requestContext: { tier: 'free' } })).toBe(false);
  });

  it('evaluates the filter against the flattened requestContext view', () => {
    // Nested `user.tier` flattens to the single key "user.tier" before persistence;
    // the filter must see the same view so it is answerable against stored rows.
    expect(
      didScore({
        filter: { op: 'eq', left: { path: 'requestContext.user.tier' }, right: { literal: 'pro' } },
        requestContext: { user: { tier: 'pro' } },
      }),
    ).toBe(true);
  });

  it('applies filter before sampling: non-qualifying traffic never reaches the rate', () => {
    // rate 1 would score everything — the filter must be the reason it skips.
    expect(didScore({ filter: matchNone, sampling: { type: 'ratio', rate: 1 } })).toBe(false);
    // Qualifying traffic still respects the rate.
    expect(didScore({ filter: matchAll, requestContext: {}, sampling: { type: 'ratio', rate: 0 } })).toBe(false);
  });

  it('survives a JSON round-trip (durable serialization)', () => {
    const roundTripped = JSON.parse(JSON.stringify(matchNone));
    expect(didScore({ filter: roundTripped, requestContext: { tier: 'pro' } })).toBe(true);
    expect(didScore({ filter: roundTripped, requestContext: { tier: 'free' } })).toBe(false);
  });
});

describe('runScorer unrecognized sampling type', () => {
  it('fails closed instead of scoring 100% of traffic', () => {
    expect(didScore({ sampling: { type: 'mystery' } as any })).toBe(false);
  });
});

describe('hashToUnitInterval', () => {
  it('returns a stable value in [0, 1)', async () => {
    for (const key of makeTraceIds(200)) {
      const value = await hashToUnitInterval(key);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      await expect(hashToUnitInterval(key)).resolves.toBe(value);
    }
  });

  it('spreads keys across the interval rather than clustering', async () => {
    const buckets = new Array(10).fill(0);
    for (const value of await Promise.all(makeTraceIds(5000).map(hashToUnitInterval))) {
      buckets[Math.floor(value * 10)]! += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(350);
    }
  });
});

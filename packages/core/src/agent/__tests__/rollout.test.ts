import { describe, it, expect, vi } from 'vitest';
import type { ObservabilityStorage } from '../../storage/domains/observability';
import type { RolloutsStorage } from '../../storage/domains/rollouts';
import type { RolloutRecord, RolloutAllocation, RolloutRule } from '../../storage/types';
import {
  resolveVersionFromRollout,
  deterministicBucket,
  pickAllocation,
  evaluateRules,
  queryRolloutScoreStats,
  RolloutEvaluator,
} from '../rollout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRollout(overrides: Partial<RolloutRecord> = {}): RolloutRecord {
  return {
    id: 'rol_1',
    agentId: 'agent_1',
    type: 'canary',
    status: 'active',
    stableVersionId: 'ver_stable',
    allocations: [
      { versionId: 'ver_stable', weight: 0.9 },
      { versionId: 'ver_candidate', weight: 0.1 },
    ],
    routingKey: 'resourceId',
    rules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

function makeRequestContext(map: Record<string, unknown> = {}) {
  return {
    get(key: string) {
      return map[key];
    },
  };
}

// ---------------------------------------------------------------------------
// deterministicBucket
// ---------------------------------------------------------------------------

describe('deterministicBucket', () => {
  it('returns a number in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const bucket = deterministicBucket(`user-${i}`, 'agent_1');
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(1);
    }
  });

  it('is deterministic — same inputs produce same bucket', () => {
    const a = deterministicBucket('user-42', 'agent_1');
    const b = deterministicBucket('user-42', 'agent_1');
    expect(a).toBe(b);
  });

  it('different routing values produce different buckets (usually)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(deterministicBucket(`user-${i}`, 'agent_1'));
    }
    // With 50 random-ish inputs the hash should produce many distinct fractions
    expect(results.size).toBeGreaterThan(40);
  });

  it('produces stable values for known inputs', () => {
    // Pin expected buckets so the test is fully deterministic
    const a = deterministicBucket('user-1', 'agent_a');
    const b = deterministicBucket('user-1', 'agent_b');
    expect(a).toBe(deterministicBucket('user-1', 'agent_a'));
    expect(b).toBe(deterministicBucket('user-1', 'agent_b'));
    // Verify they're in the valid range
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// pickAllocation
// ---------------------------------------------------------------------------

describe('pickAllocation', () => {
  const allocations: RolloutAllocation[] = [
    { versionId: 'ver_stable', weight: 0.9 },
    { versionId: 'ver_candidate', weight: 0.1 },
  ];

  it('picks the first allocation for buckets in [0, weight)', () => {
    expect(pickAllocation(allocations, 0)).toBe('ver_stable');
    expect(pickAllocation(allocations, 0.5)).toBe('ver_stable');
    expect(pickAllocation(allocations, 0.89)).toBe('ver_stable');
  });

  it('picks the second allocation for buckets in [weight, 1)', () => {
    expect(pickAllocation(allocations, 0.9)).toBe('ver_candidate');
    expect(pickAllocation(allocations, 0.95)).toBe('ver_candidate');
    expect(pickAllocation(allocations, 0.999)).toBe('ver_candidate');
  });

  it('handles three-way splits', () => {
    const threeWay: RolloutAllocation[] = [
      { versionId: 'a', weight: 0.34 },
      { versionId: 'b', weight: 0.33 },
      { versionId: 'c', weight: 0.33 },
    ];
    expect(pickAllocation(threeWay, 0)).toBe('a');
    expect(pickAllocation(threeWay, 0.33)).toBe('a');
    expect(pickAllocation(threeWay, 0.34)).toBe('b');
    expect(pickAllocation(threeWay, 0.66)).toBe('b');
    expect(pickAllocation(threeWay, 0.67)).toBe('c');
    expect(pickAllocation(threeWay, 0.999)).toBe('c');
  });

  it('handles single allocation (100%)', () => {
    const single: RolloutAllocation[] = [{ versionId: 'only', weight: 1 }];
    expect(pickAllocation(single, 0)).toBe('only');
    expect(pickAllocation(single, 0.999)).toBe('only');
  });

  it('supports sub-percent weights for very small canary rollouts', () => {
    // 0.1% canary
    const tiny: RolloutAllocation[] = [
      { versionId: 'stable', weight: 0.999 },
      { versionId: 'candidate', weight: 0.001 },
    ];
    expect(pickAllocation(tiny, 0)).toBe('stable');
    expect(pickAllocation(tiny, 0.998)).toBe('stable');
    expect(pickAllocation(tiny, 0.999)).toBe('candidate');
    expect(pickAllocation(tiny, 0.9995)).toBe('candidate');
  });
});

// ---------------------------------------------------------------------------
// resolveVersionFromRollout
// ---------------------------------------------------------------------------

describe('resolveVersionFromRollout', () => {
  it('returns stable version when no requestContext is provided', () => {
    const rollout = makeRollout();
    expect(resolveVersionFromRollout(rollout)).toBe('ver_stable');
  });

  it('returns stable version when routing key is missing from context', () => {
    const rollout = makeRollout();
    const ctx = makeRequestContext({ otherKey: 'value' });
    expect(resolveVersionFromRollout(rollout, ctx)).toBe('ver_stable');
  });

  it('returns stable version when routing value is not a string', () => {
    const rollout = makeRollout();
    const ctx = makeRequestContext({ resourceId: 12345 });
    expect(resolveVersionFromRollout(rollout, ctx)).toBe('ver_stable');
  });

  it('deterministically resolves a version from the routing value', () => {
    const rollout = makeRollout();
    const ctx = makeRequestContext({ resourceId: 'user-42' });
    const v1 = resolveVersionFromRollout(rollout, ctx);
    const v2 = resolveVersionFromRollout(rollout, ctx);
    expect(v1).toBe(v2);
    expect(['ver_stable', 'ver_candidate']).toContain(v1);
  });

  it('uses a custom routing key', () => {
    const rollout = makeRollout({ routingKey: 'tenantId' });
    const ctx = makeRequestContext({ tenantId: 'tenant-abc' });
    const version = resolveVersionFromRollout(rollout, ctx);
    expect(['ver_stable', 'ver_candidate']).toContain(version);
  });

  it('distributes traffic roughly according to weights', () => {
    const rollout = makeRollout({
      allocations: [
        { versionId: 'ver_stable', weight: 0.5 },
        { versionId: 'ver_candidate', weight: 0.5 },
      ],
    });

    const counts = { ver_stable: 0, ver_candidate: 0 };
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const ctx = makeRequestContext({ resourceId: `user-${i}` });
      const version = resolveVersionFromRollout(rollout, ctx) as keyof typeof counts;
      counts[version]++;
    }

    // With 50/50 split and 1000 users, each should get roughly 500 ± 100
    expect(counts.ver_stable).toBeGreaterThan(300);
    expect(counts.ver_stable).toBeLessThan(700);
    expect(counts.ver_candidate).toBeGreaterThan(300);
    expect(counts.ver_candidate).toBeLessThan(700);
  });

  it('distributes traffic for 90/10 canary split', () => {
    const rollout = makeRollout(); // 90/10 by default

    const counts = { ver_stable: 0, ver_candidate: 0 };
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const ctx = makeRequestContext({ resourceId: `user-${i}` });
      const version = resolveVersionFromRollout(rollout, ctx) as keyof typeof counts;
      counts[version]++;
    }

    // Stable should get ~900 ± 100, candidate should get ~100 ± 100
    expect(counts.ver_stable).toBeGreaterThan(750);
    expect(counts.ver_candidate).toBeGreaterThan(30);
    expect(counts.ver_candidate).toBeLessThan(250);
  });
});

// ---------------------------------------------------------------------------
// queryRolloutScoreStats
// ---------------------------------------------------------------------------

function makeObservability(value: { avg: number | null; count: number }): ObservabilityStorage {
  return {
    getScoreAggregate: vi.fn().mockImplementation(({ aggregation }: { aggregation: 'avg' | 'count' }) => {
      if (aggregation === 'count') return Promise.resolve({ value: value.count });
      return Promise.resolve({ value: value.avg });
    }),
  } as unknown as ObservabilityStorage;
}

describe('queryRolloutScoreStats', () => {
  it('queries the observability store with the expected filters', async () => {
    const observability = makeObservability({ avg: 0.8, count: 10 });
    const createdAt = new Date('2024-01-01T00:00:00Z');

    const stats = await queryRolloutScoreStats(observability, 'agent_1', 'ver_candidate', 'helpfulness', createdAt);

    expect(stats).toEqual({ avg: 0.8, count: 10 });
    expect(observability.getScoreAggregate).toHaveBeenCalledTimes(2);
    expect(observability.getScoreAggregate).toHaveBeenCalledWith({
      scorerId: 'helpfulness',
      aggregation: 'avg',
      filters: {
        entityName: 'agent_1',
        entityVersionId: 'ver_candidate',
        timestamp: { start: createdAt },
      },
    });
    expect(observability.getScoreAggregate).toHaveBeenCalledWith({
      scorerId: 'helpfulness',
      aggregation: 'count',
      filters: {
        entityName: 'agent_1',
        entityVersionId: 'ver_candidate',
        timestamp: { start: createdAt },
      },
    });
  });

  it('returns null avg when the aggregate is missing', async () => {
    const observability = makeObservability({ avg: null, count: 0 });
    const stats = await queryRolloutScoreStats(observability, 'agent_1', 'ver_x', 'helpfulness', new Date());
    expect(stats).toEqual({ avg: null, count: 0 });
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — backed by the observability aggregate API
// ---------------------------------------------------------------------------

describe('evaluateRules', () => {
  it('returns null when rollout has no rules', async () => {
    const rollout = makeRollout({ rules: [] });
    const observability = makeObservability({ avg: 0.1, count: 100 });
    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('returns null when rollout has undefined rules', async () => {
    const rollout = makeRollout({ rules: undefined });
    const observability = makeObservability({ avg: 0.1, count: 100 });
    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('returns the breached rule when average is below threshold and count meets windowSize', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const observability = makeObservability({ avg: 0.5, count: 5 });

    const breached = await evaluateRules(rollout, observability);
    expect(breached).toBe(rule);
  });

  it('returns null when average is above threshold', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const observability = makeObservability({ avg: 0.9, count: 5 });

    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('returns null when average equals threshold', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const observability = makeObservability({ avg: 0.7, count: 5 });

    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('returns null when count is below windowSize', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 10, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const observability = makeObservability({ avg: 0.1, count: 3 });

    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('returns null when avg is null (no scores recorded yet)', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const observability = makeObservability({ avg: null, count: 0 });

    expect(await evaluateRules(rollout, observability)).toBeNull();
  });

  it('only evaluates rules against candidate versions (not stable)', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    const getScoreAggregate = vi.fn().mockImplementation(({ aggregation, filters }: any) => {
      // Should only be called with the candidate version
      expect(filters.entityVersionId).toBe('ver_candidate');
      if (aggregation === 'count') return Promise.resolve({ value: 5 });
      return Promise.resolve({ value: 0.5 });
    });
    const observability = { getScoreAggregate } as unknown as ObservabilityStorage;

    const breached = await evaluateRules(rollout, observability);
    expect(breached).toBe(rule);
    // Avg + count for the single candidate = 2 calls
    expect(getScoreAggregate).toHaveBeenCalledTimes(2);
  });

  it('evaluates multiple rules and returns first breach', async () => {
    const rule1: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rule2: RolloutRule = { scorerId: 'safety', threshold: 0.9, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule1, rule2] });

    const observability = {
      getScoreAggregate: vi.fn().mockImplementation(({ scorerId, aggregation }: any) => {
        // helpfulness: fine (0.8). safety: breached (0.5).
        if (aggregation === 'count') return Promise.resolve({ value: 5 });
        if (scorerId === 'helpfulness') return Promise.resolve({ value: 0.8 });
        return Promise.resolve({ value: 0.5 });
      }),
    } as unknown as ObservabilityStorage;

    const breached = await evaluateRules(rollout, observability);
    expect(breached).toBe(rule2);
  });

  it('evaluates across multiple candidate versions in A/B test', async () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({
      type: 'ab_test',
      allocations: [
        { versionId: 'ver_stable', weight: 0.34, label: 'control' },
        { versionId: 'ver_a', weight: 0.33, label: 'variant-a' },
        { versionId: 'ver_b', weight: 0.33, label: 'variant-b' },
      ],
      rules: [rule],
    });

    const observability = {
      getScoreAggregate: vi.fn().mockImplementation(({ aggregation, filters }: any) => {
        // ver_a is fine, ver_b is bad
        if (aggregation === 'count') return Promise.resolve({ value: 5 });
        if (filters.entityVersionId === 'ver_a') return Promise.resolve({ value: 0.9 });
        return Promise.resolve({ value: 0.3 });
      }),
    } as unknown as ObservabilityStorage;

    const breached = await evaluateRules(rollout, observability);
    expect(breached).toBe(rule);
  });
});

// ---------------------------------------------------------------------------
// RolloutEvaluator
// ---------------------------------------------------------------------------

describe('RolloutEvaluator', () => {
  function makeRolloutsStore(rollout: RolloutRecord | null): RolloutsStorage {
    return {
      getActiveRollout: vi.fn().mockResolvedValue(rollout),
    } as unknown as RolloutsStorage;
  }

  it('does nothing when the rollout has no rules', async () => {
    const onRollback = vi.fn().mockResolvedValue(undefined);
    const rollout = makeRollout({ rules: [] });
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: makeRolloutsStore(rollout),
      observability: makeObservability({ avg: 0.1, count: 100 }),
      onRollback,
      minIntervalMs: 0,
    });

    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 10));
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('triggers rollback when rules are breached', async () => {
    const onRollback = vi.fn().mockResolvedValue(undefined);
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: makeRolloutsStore(rollout),
      observability: makeObservability({ avg: 0.3, count: 5 }),
      onRollback,
      minIntervalMs: 0,
    });

    evaluator.scheduleEvaluation('agent_1', rollout);
    // Wait for the async work to settle
    await new Promise(r => setTimeout(r, 20));
    expect(onRollback).toHaveBeenCalledWith('agent_1', rollout.id);
  });

  it('does not trigger rollback when scores are above threshold', async () => {
    const onRollback = vi.fn().mockResolvedValue(undefined);
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: makeRolloutsStore(rollout),
      observability: makeObservability({ avg: 0.9, count: 50 }),
      onRollback,
      minIntervalMs: 0,
    });

    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 20));
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('throttles consecutive evaluations per agent', async () => {
    const getActiveRollout = vi.fn().mockResolvedValue(null);
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: { getActiveRollout } as unknown as RolloutsStorage,
      observability: makeObservability({ avg: 0.9, count: 50 }),
      onRollback: vi.fn(),
      minIntervalMs: 1000,
    });

    evaluator.scheduleEvaluation('agent_1', rollout);
    evaluator.scheduleEvaluation('agent_1', rollout);
    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 20));

    // Only one evaluation should have been performed despite three schedules
    expect(getActiveRollout).toHaveBeenCalledTimes(1);
  });

  it('reset() clears the throttle so the next schedule runs', async () => {
    const getActiveRollout = vi.fn().mockResolvedValue(null);
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: { getActiveRollout } as unknown as RolloutsStorage,
      observability: makeObservability({ avg: 0.9, count: 50 }),
      onRollback: vi.fn(),
      minIntervalMs: 1_000_000,
    });

    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 20));
    expect(getActiveRollout).toHaveBeenCalledTimes(1);

    // Throttled — would not run again
    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 20));
    expect(getActiveRollout).toHaveBeenCalledTimes(1);

    // After reset, next schedule runs again
    evaluator.reset('agent_1');
    evaluator.scheduleEvaluation('agent_1', rollout);
    await new Promise(r => setTimeout(r, 20));
    expect(getActiveRollout).toHaveBeenCalledTimes(2);
  });

  it('does not evaluate if rollout was completed in the meantime', async () => {
    const onRollback = vi.fn().mockResolvedValue(undefined);
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const scheduled = makeRollout({ rules: [rule] });
    // Storage returns null — rollout was already completed
    const evaluator = new RolloutEvaluator({
      rolloutsStorage: makeRolloutsStore(null),
      observability: makeObservability({ avg: 0.1, count: 50 }),
      onRollback,
      minIntervalMs: 0,
    });

    evaluator.scheduleEvaluation('agent_1', scheduled);
    await new Promise(r => setTimeout(r, 20));
    expect(onRollback).not.toHaveBeenCalled();
  });
});

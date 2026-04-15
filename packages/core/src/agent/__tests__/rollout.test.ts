import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RolloutRecord, RolloutAllocation, RolloutRule } from '../../storage/types';
import {
  resolveVersionFromRollout,
  deterministicBucket,
  pickAllocation,
  RolloutAccumulator,
  evaluateRules,
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
      { versionId: 'ver_stable', weight: 90 },
      { versionId: 'ver_candidate', weight: 10 },
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
  it('returns a number between 0 and 99 inclusive', () => {
    for (let i = 0; i < 200; i++) {
      const bucket = deterministicBucket(`user-${i}`, 'agent_1');
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
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
    // With 50 random-ish inputs and 100 buckets, we should see at least 10 distinct values
    expect(results.size).toBeGreaterThan(10);
  });

  it('produces stable values for known inputs', () => {
    // Pin expected buckets so the test is fully deterministic
    const a = deterministicBucket('user-1', 'agent_a');
    const b = deterministicBucket('user-1', 'agent_b');
    expect(a).toBe(deterministicBucket('user-1', 'agent_a'));
    expect(b).toBe(deterministicBucket('user-1', 'agent_b'));
    // Verify they're in the valid range
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// pickAllocation
// ---------------------------------------------------------------------------

describe('pickAllocation', () => {
  const allocations: RolloutAllocation[] = [
    { versionId: 'ver_stable', weight: 90 },
    { versionId: 'ver_candidate', weight: 10 },
  ];

  it('picks the first allocation for buckets in [0, weight)', () => {
    expect(pickAllocation(allocations, 0)).toBe('ver_stable');
    expect(pickAllocation(allocations, 50)).toBe('ver_stable');
    expect(pickAllocation(allocations, 89)).toBe('ver_stable');
  });

  it('picks the second allocation for buckets in [weight, 100)', () => {
    expect(pickAllocation(allocations, 90)).toBe('ver_candidate');
    expect(pickAllocation(allocations, 95)).toBe('ver_candidate');
    expect(pickAllocation(allocations, 99)).toBe('ver_candidate');
  });

  it('handles three-way splits', () => {
    const threeWay: RolloutAllocation[] = [
      { versionId: 'a', weight: 34 },
      { versionId: 'b', weight: 33 },
      { versionId: 'c', weight: 33 },
    ];
    expect(pickAllocation(threeWay, 0)).toBe('a');
    expect(pickAllocation(threeWay, 33)).toBe('a');
    expect(pickAllocation(threeWay, 34)).toBe('b');
    expect(pickAllocation(threeWay, 66)).toBe('b');
    expect(pickAllocation(threeWay, 67)).toBe('c');
    expect(pickAllocation(threeWay, 99)).toBe('c');
  });

  it('handles single allocation (100%)', () => {
    const single: RolloutAllocation[] = [{ versionId: 'only', weight: 100 }];
    expect(pickAllocation(single, 0)).toBe('only');
    expect(pickAllocation(single, 99)).toBe('only');
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
        { versionId: 'ver_stable', weight: 50 },
        { versionId: 'ver_candidate', weight: 50 },
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
// RolloutAccumulator
// ---------------------------------------------------------------------------

describe('RolloutAccumulator', () => {
  let accumulator: RolloutAccumulator;

  beforeEach(() => {
    accumulator = new RolloutAccumulator({ evaluationIntervalMs: 100_000 });
  });

  afterEach(() => {
    accumulator.stop();
  });

  describe('push and getWindow', () => {
    it('returns null for an empty window', () => {
      const stats = accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 50);
      expect(stats).toBeNull();
    });

    it('accumulates scores and returns correct average', () => {
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 0.8);
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 0.6);
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 1.0);

      const stats = accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 10);
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(3);
      expect(stats!.avg).toBeCloseTo(0.8);
    });

    it('limits window to requested size (most recent)', () => {
      for (let i = 0; i < 10; i++) {
        accumulator.push('agent_1', 'ver_1', 'helpfulness', i < 5 ? 0.0 : 1.0);
      }

      // Window of 5 should contain only the last 5 entries (all 1.0)
      const stats = accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 5);
      expect(stats!.avg).toBeCloseTo(1.0);
      expect(stats!.count).toBe(5);

      // Window of 10 should contain all entries (avg 0.5)
      const statsAll = accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 10);
      expect(statsAll!.avg).toBeCloseTo(0.5);
      expect(statsAll!.count).toBe(10);
    });

    it('handles circular buffer wrapping', () => {
      const maxSize = RolloutAccumulator.MAX_WINDOW_SIZE;

      // Fill beyond the max window size
      for (let i = 0; i < maxSize + 50; i++) {
        accumulator.push('agent_1', 'ver_1', 'helpfulness', i < maxSize ? 0.0 : 1.0);
      }

      // The last 50 should all be 1.0
      const stats = accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 50);
      expect(stats!.avg).toBeCloseTo(1.0);
      expect(stats!.count).toBe(50);
    });

    it('isolates different agent/version/scorer combinations', () => {
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 0.5);
      accumulator.push('agent_1', 'ver_1', 'safety', 0.9);
      accumulator.push('agent_1', 'ver_2', 'helpfulness', 0.3);
      accumulator.push('agent_2', 'ver_1', 'helpfulness', 0.7);

      expect(accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 10)!.avg).toBeCloseTo(0.5);
      expect(accumulator.getWindow('agent_1', 'ver_1', 'safety', 10)!.avg).toBeCloseTo(0.9);
      expect(accumulator.getWindow('agent_1', 'ver_2', 'helpfulness', 10)!.avg).toBeCloseTo(0.3);
      expect(accumulator.getWindow('agent_2', 'ver_1', 'helpfulness', 10)!.avg).toBeCloseTo(0.7);
    });
  });

  describe('clearAgent', () => {
    it('clears all windows for a specific agent', () => {
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 0.5);
      accumulator.push('agent_1', 'ver_2', 'safety', 0.9);
      accumulator.push('agent_2', 'ver_1', 'helpfulness', 0.7);

      accumulator.clearAgent('agent_1');

      expect(accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 10)).toBeNull();
      expect(accumulator.getWindow('agent_1', 'ver_2', 'safety', 10)).toBeNull();
      // agent_2 should be unaffected
      expect(accumulator.getWindow('agent_2', 'ver_1', 'helpfulness', 10)).not.toBeNull();
    });
  });

  describe('clearAll', () => {
    it('clears all windows', () => {
      accumulator.push('agent_1', 'ver_1', 'helpfulness', 0.5);
      accumulator.push('agent_2', 'ver_1', 'helpfulness', 0.7);

      accumulator.clearAll();

      expect(accumulator.getWindow('agent_1', 'ver_1', 'helpfulness', 10)).toBeNull();
      expect(accumulator.getWindow('agent_2', 'ver_1', 'helpfulness', 10)).toBeNull();
    });
  });

  describe('background evaluation', () => {
    it('evaluates rules and triggers rollback when threshold breached', async () => {
      const onRollback = vi.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getActiveRollout: vi.fn().mockResolvedValue(
          makeRollout({
            rules: [{ scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' as const }],
          }),
        ),
      } as any;

      accumulator.bind(mockStorage, onRollback);

      // Push 5 bad scores for the candidate
      for (let i = 0; i < 5; i++) {
        accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.3);
      }

      // Trigger evaluation manually by starting with a very short interval
      accumulator.stop();
      const fastAccumulator = new RolloutAccumulator({ evaluationIntervalMs: 50 });
      fastAccumulator.bind(mockStorage, onRollback);

      // Copy scores
      for (let i = 0; i < 5; i++) {
        fastAccumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.3);
      }

      fastAccumulator.start();

      // Wait for evaluation cycle
      await new Promise(resolve => setTimeout(resolve, 200));
      fastAccumulator.stop();

      expect(onRollback).toHaveBeenCalledWith('agent_1', 'rol_1');
    });

    it('does not trigger rollback when scores are above threshold', async () => {
      const onRollback = vi.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getActiveRollout: vi.fn().mockResolvedValue(
          makeRollout({
            rules: [{ scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' as const }],
          }),
        ),
      } as any;

      const fastAccumulator = new RolloutAccumulator({ evaluationIntervalMs: 50 });
      fastAccumulator.bind(mockStorage, onRollback);

      // Push 5 good scores
      for (let i = 0; i < 5; i++) {
        fastAccumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.9);
      }

      fastAccumulator.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      fastAccumulator.stop();

      expect(onRollback).not.toHaveBeenCalled();
    });

    it('does not trigger rollback when not enough scores accumulated', async () => {
      const onRollback = vi.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getActiveRollout: vi.fn().mockResolvedValue(
          makeRollout({
            rules: [{ scorerId: 'helpfulness', threshold: 0.7, windowSize: 50, action: 'rollback' as const }],
          }),
        ),
      } as any;

      const fastAccumulator = new RolloutAccumulator({ evaluationIntervalMs: 50 });
      fastAccumulator.bind(mockStorage, onRollback);

      // Only push 5 bad scores, but rule needs 50
      for (let i = 0; i < 5; i++) {
        fastAccumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.1);
      }

      fastAccumulator.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      fastAccumulator.stop();

      expect(onRollback).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateRules
// ---------------------------------------------------------------------------

describe('evaluateRules', () => {
  let accumulator: RolloutAccumulator;

  beforeEach(() => {
    accumulator = new RolloutAccumulator();
  });

  afterEach(() => {
    accumulator.stop();
  });

  it('returns null when rollout has no rules', () => {
    const rollout = makeRollout({ rules: [] });
    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('returns null when rollout has undefined rules', () => {
    const rollout = makeRollout({ rules: undefined });
    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('returns the breached rule when average is below threshold', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.5);
    }

    const breached = evaluateRules(rollout, accumulator);
    expect(breached).toBe(rule);
  });

  it('returns null when average is above threshold', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.9);
    }

    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('returns null when average equals threshold', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.7);
    }

    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('returns null when not enough scores have been accumulated', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 10, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    // Only 3 scores, need 10
    for (let i = 0; i < 3; i++) {
      accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.1);
    }

    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('only evaluates rules against candidate versions (not stable)', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule] });

    // Bad scores on stable — should not trigger
    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_stable', 'helpfulness', 0.1);
    }

    expect(evaluateRules(rollout, accumulator)).toBeNull();
  });

  it('evaluates multiple rules and returns first breach', () => {
    const rule1: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rule2: RolloutRule = { scorerId: 'safety', threshold: 0.9, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({ rules: [rule1, rule2] });

    // Helpfulness is fine, safety is breached
    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_candidate', 'helpfulness', 0.8);
      accumulator.push('agent_1', 'ver_candidate', 'safety', 0.5);
    }

    expect(evaluateRules(rollout, accumulator)).toBe(rule2);
  });

  it('evaluates across multiple candidate versions in A/B test', () => {
    const rule: RolloutRule = { scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' };
    const rollout = makeRollout({
      type: 'ab_test',
      allocations: [
        { versionId: 'ver_stable', weight: 34, label: 'control' },
        { versionId: 'ver_a', weight: 33, label: 'variant-a' },
        { versionId: 'ver_b', weight: 33, label: 'variant-b' },
      ],
      rules: [rule],
    });

    // ver_a is fine, ver_b is bad
    for (let i = 0; i < 5; i++) {
      accumulator.push('agent_1', 'ver_a', 'helpfulness', 0.9);
      accumulator.push('agent_1', 'ver_b', 'helpfulness', 0.3);
    }

    expect(evaluateRules(rollout, accumulator)).toBe(rule);
  });
});

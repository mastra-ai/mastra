import { describe, it, expect, beforeEach, vi } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { ObservabilityStorage } from '../../storage/domains/observability';
import { RolloutsInMemory } from '../../storage/domains/rollouts/inmemory';
import type { CreateRolloutInput } from '../../storage/types';
import { resolveVersionFromRollout, evaluateRules } from '../rollout';

// Build a stub ObservabilityStorage that returns the supplied per-version stats.
function makeObservability(
  byVersion: Record<string, Record<string, { avg: number | null; count: number }>>,
): ObservabilityStorage {
  return {
    getScoreAggregate: vi.fn().mockImplementation(({ scorerId, aggregation, filters }: any) => {
      const versionId = filters?.entityVersionId as string | undefined;
      const stats = versionId ? byVersion[versionId]?.[scorerId] : undefined;
      const value = !stats ? (aggregation === 'count' ? 0 : null) : aggregation === 'count' ? stats.count : stats.avg;
      return Promise.resolve({ value });
    }),
  } as unknown as ObservabilityStorage;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequestContext(map: Record<string, unknown> = {}) {
  return {
    get(key: string) {
      return map[key];
    },
  };
}

// ---------------------------------------------------------------------------
// In-Memory Storage Tests
// ---------------------------------------------------------------------------

describe('RolloutsInMemory storage', () => {
  let store: RolloutsInMemory;

  beforeEach(() => {
    const db = new InMemoryDB();
    store = new RolloutsInMemory({ db });
  });

  it('creates a rollout with generated ID', async () => {
    const input: CreateRolloutInput = {
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    };

    const rollout = await store.createRollout(input);
    expect(rollout.id).toMatch(/^rol_/);
    expect(rollout.agentId).toBe('agent_1');
    expect(rollout.type).toBe('canary');
    expect(rollout.status).toBe('active');
    expect(rollout.stableVersionId).toBe('ver_7');
    expect(rollout.allocations).toHaveLength(2);
    expect(rollout.createdAt).toBeInstanceOf(Date);
    expect(rollout.updatedAt).toBeInstanceOf(Date);
    expect(rollout.completedAt).toBeNull();
  });

  it('creates a rollout with specified ID', async () => {
    const rollout = await store.createRollout({
      id: 'rol_custom',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    expect(rollout.id).toBe('rol_custom');
  });

  it('retrieves a rollout by ID', async () => {
    const created = await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    const retrieved = await store.getRollout('rol_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.agentId).toBe('agent_1');
  });

  it('returns null for non-existent rollout', async () => {
    const result = await store.getRollout('rol_nonexistent');
    expect(result).toBeNull();
  });

  it('retrieves the active rollout for an agent', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    const active = await store.getActiveRollout('agent_1');
    expect(active).not.toBeNull();
    expect(active!.id).toBe('rol_1');
  });

  it('returns null when no active rollout exists', async () => {
    const active = await store.getActiveRollout('agent_1');
    expect(active).toBeNull();
  });

  it('returns null for completed rollouts when querying active', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    await store.completeRollout('rol_1', 'completed');

    const active = await store.getActiveRollout('agent_1');
    expect(active).toBeNull();
  });

  it('updates rollout allocations', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    const updated = await store.updateRollout({
      id: 'rol_1',
      allocations: [
        { versionId: 'ver_7', weight: 0.5 },
        { versionId: 'ver_8', weight: 0.5 },
      ],
    });

    expect(updated.allocations[0]!.weight).toBe(0.5);
    expect(updated.allocations[1]!.weight).toBe(0.5);
  });

  it('throws when updating a non-existent rollout', async () => {
    await expect(store.updateRollout({ id: 'rol_nonexistent', allocations: [] })).rejects.toThrow('Rollout not found');
  });

  it('throws when updating a completed rollout', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    await store.completeRollout('rol_1', 'completed');

    await expect(store.updateRollout({ id: 'rol_1', allocations: [] })).rejects.toThrow(
      'Cannot update rollout with status: completed',
    );
  });

  it('completes a rollout with a terminal status', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    const completed = await store.completeRollout('rol_1', 'rolled_back');
    expect(completed.status).toBe('rolled_back');
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  it('lists rollouts with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await store.createRollout({
        id: `rol_${i}`,
        agentId: 'agent_1',
        type: 'canary',
        stableVersionId: 'ver_7',
        allocations: [
          { versionId: 'ver_7', weight: 0.9 },
          { versionId: `ver_${i}`, weight: 0.1 },
        ],
      });
      // Complete before creating the next so the active-rollout invariant isn't violated
      await store.completeRollout(`rol_${i}`, 'completed');
    }

    const page1 = await store.listRollouts({
      agentId: 'agent_1',
      pagination: { page: 0, perPage: 2 },
    });

    expect(page1.rollouts).toHaveLength(2);
    expect(page1.pagination.total).toBe(5);
    expect(page1.pagination.hasMore).toBe(true);

    const page2 = await store.listRollouts({
      agentId: 'agent_1',
      pagination: { page: 1, perPage: 2 },
    });

    expect(page2.rollouts).toHaveLength(2);
    expect(page2.pagination.hasMore).toBe(true);
  });

  it('lists rollouts only for the specified agent', async () => {
    await store.createRollout({
      id: 'rol_a1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [{ versionId: 'ver_7', weight: 1 }],
    });

    await store.createRollout({
      id: 'rol_a2',
      agentId: 'agent_2',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [{ versionId: 'ver_7', weight: 1 }],
    });

    const result = await store.listRollouts({
      agentId: 'agent_1',
      pagination: { page: 0, perPage: 10 },
    });

    expect(result.rollouts).toHaveLength(1);
    expect(result.rollouts[0]!.id).toBe('rol_a1');
  });

  it('clears all data with dangerouslyClearAll', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [{ versionId: 'ver_7', weight: 1 }],
    });

    await store.dangerouslyClearAll();

    const result = await store.getRollout('rol_1');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Canary Rollout Lifecycle (end-to-end)
// ---------------------------------------------------------------------------

describe('canary rollout lifecycle', () => {
  let store: RolloutsInMemory;

  beforeEach(() => {
    const db = new InMemoryDB();
    store = new RolloutsInMemory({ db });
  });

  it('start → ramp → promote', async () => {
    // 1. Start rollout at 10% candidate
    const rollout = await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9, label: 'stable' },
        { versionId: 'ver_8', weight: 0.1, label: 'candidate' },
      ],
      routingKey: 'resourceId',
    });

    expect(rollout.status).toBe('active');

    // 2. Verify traffic split works
    const ctx = makeRequestContext({ resourceId: 'user-1' });
    const v = resolveVersionFromRollout(rollout, ctx);
    expect(['ver_7', 'ver_8']).toContain(v);

    // 3. Ramp to 50%
    const ramped = await store.updateRollout({
      id: 'rol_1',
      allocations: [
        { versionId: 'ver_7', weight: 0.5, label: 'stable' },
        { versionId: 'ver_8', weight: 0.5, label: 'candidate' },
      ],
    });

    expect(ramped.allocations[1]!.weight).toBe(0.5);

    // 4. Promote: mark as completed
    const promoted = await store.completeRollout('rol_1', 'completed');
    expect(promoted.status).toBe('completed');
    expect(promoted.completedAt).toBeInstanceOf(Date);

    // 5. No active rollout anymore
    const active = await store.getActiveRollout('agent_1');
    expect(active).toBeNull();
  });

  it('start → rollback on bad scores', async () => {
    const rollout = await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
      rules: [{ scorerId: 'helpfulness', threshold: 0.7, windowSize: 5, action: 'rollback' }],
    });

    // Observability returns enough bad scores for the candidate to breach the rule
    const observability = makeObservability({
      ver_8: { helpfulness: { avg: 0.3, count: 5 } },
    });

    // Evaluate rules against observability aggregates
    const breached = await evaluateRules(rollout, observability);
    expect(breached).not.toBeNull();
    expect(breached!.scorerId).toBe('helpfulness');

    // Rollback
    const rolledBack = await store.completeRollout('rol_1', 'rolled_back');
    expect(rolledBack.status).toBe('rolled_back');
  });

  it('start → cancel', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.9 },
        { versionId: 'ver_8', weight: 0.1 },
      ],
    });

    const cancelled = await store.completeRollout('rol_1', 'cancelled');
    expect(cancelled.status).toBe('cancelled');

    const active = await store.getActiveRollout('agent_1');
    expect(active).toBeNull();
  });

  it('sticky routing: same user always gets the same version', async () => {
    const rollout = await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'canary',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.5 },
        { versionId: 'ver_8', weight: 0.5 },
      ],
      routingKey: 'resourceId',
    });

    const ctx = makeRequestContext({ resourceId: 'user-42' });
    const first = resolveVersionFromRollout(rollout, ctx);

    // 100 calls with the same user should always return the same version
    for (let i = 0; i < 100; i++) {
      expect(resolveVersionFromRollout(rollout, ctx)).toBe(first);
    }
  });
});

// ---------------------------------------------------------------------------
// A/B Test Lifecycle (end-to-end)
// ---------------------------------------------------------------------------

describe('A/B test lifecycle', () => {
  let store: RolloutsInMemory;

  beforeEach(() => {
    const db = new InMemoryDB();
    store = new RolloutsInMemory({ db });
  });

  it('start → collect scores → conclude with winner', async () => {
    // 1. Start A/B test
    const rollout = await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'ab_test',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.34, label: 'control' },
        { versionId: 'ver_8', weight: 0.33, label: 'variant-a' },
        { versionId: 'ver_9', weight: 0.33, label: 'variant-b' },
      ],
      routingKey: 'resourceId',
    });

    expect(rollout.type).toBe('ab_test');
    expect(rollout.allocations).toHaveLength(3);

    // 2. Simulate traffic
    const versions = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const ctx = makeRequestContext({ resourceId: `user-${i}` });
      versions.add(resolveVersionFromRollout(rollout, ctx));
    }
    // With 300 users and three versions, all three should be hit
    expect(versions.size).toBe(3);

    // 3. Observability returns aggregated scores per variant
    const observability = makeObservability({
      ver_7: { helpfulness: { avg: 0.7, count: 50 } },
      ver_8: { helpfulness: { avg: 0.85, count: 50 } },
      ver_9: { helpfulness: { avg: 0.6, count: 50 } },
    });

    // 4. Verify aggregates — variant-a is best
    const [control, variantA, variantB] = await Promise.all([
      observability.getScoreAggregate({
        scorerId: 'helpfulness',
        aggregation: 'avg',
        filters: { entityName: 'agent_1', entityVersionId: 'ver_7' },
      }),
      observability.getScoreAggregate({
        scorerId: 'helpfulness',
        aggregation: 'avg',
        filters: { entityName: 'agent_1', entityVersionId: 'ver_8' },
      }),
      observability.getScoreAggregate({
        scorerId: 'helpfulness',
        aggregation: 'avg',
        filters: { entityName: 'agent_1', entityVersionId: 'ver_9' },
      }),
    ]);

    expect(control.value).toBeCloseTo(0.7);
    expect(variantA.value).toBeCloseTo(0.85);
    expect(variantB.value).toBeCloseTo(0.6);

    // 5. Conclude: promote variant-a as winner
    const completed = await store.completeRollout('rol_1', 'completed');
    expect(completed.status).toBe('completed');
  });

  it('handles A/B test cancellation', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'ab_test',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.5, label: 'control' },
        { versionId: 'ver_8', weight: 0.5, label: 'variant' },
      ],
    });

    const cancelled = await store.completeRollout('rol_1', 'cancelled');
    expect(cancelled.status).toBe('cancelled');

    const active = await store.getActiveRollout('agent_1');
    expect(active).toBeNull();
  });

  it('multiple scorers tracked independently during A/B test', async () => {
    await store.createRollout({
      id: 'rol_1',
      agentId: 'agent_1',
      type: 'ab_test',
      stableVersionId: 'ver_7',
      allocations: [
        { versionId: 'ver_7', weight: 0.5, label: 'control' },
        { versionId: 'ver_8', weight: 0.5, label: 'variant' },
      ],
    });

    // Aggregated scores per (version, scorer)
    const observability = makeObservability({
      ver_7: {
        helpfulness: { avg: 0.8, count: 20 },
        safety: { avg: 0.95, count: 20 },
      },
      ver_8: {
        helpfulness: { avg: 0.85, count: 20 },
        safety: { avg: 0.92, count: 20 },
      },
    });

    async function avgFor(versionId: string, scorerId: string) {
      const res = await observability.getScoreAggregate({
        scorerId,
        aggregation: 'avg',
        filters: { entityName: 'agent_1', entityVersionId: versionId },
      });
      return res.value as number;
    }

    expect(await avgFor('ver_7', 'helpfulness')).toBeCloseTo(0.8);
    expect(await avgFor('ver_7', 'safety')).toBeCloseTo(0.95);
    expect(await avgFor('ver_8', 'helpfulness')).toBeCloseTo(0.85);
    expect(await avgFor('ver_8', 'safety')).toBeCloseTo(0.92);
  });
});

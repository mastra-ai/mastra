import { coreFeatures } from '@mastra/core/features';
import type { ObservabilityStorage } from '@mastra/core/storage';
import type { RolloutAllocation, RolloutRecord } from '@mastra/core/storage';

type CoreRolloutHelpers = {
  resolveVersionFromRollout: (rollout: RolloutRecord, requestContext?: { get(key: string): unknown }) => string;
  queryRolloutScoreStats: (
    observability: ObservabilityStorage,
    agentId: string,
    versionId: string,
    scorerId: string,
    rolloutCreatedAt: Date,
  ) => Promise<RolloutScoreStats>;
};

let coreRolloutHelpersPromise: Promise<CoreRolloutHelpers | undefined> | undefined;

async function loadCoreRolloutHelpers(): Promise<CoreRolloutHelpers | undefined> {
  if (!coreFeatures.has('agent-rollouts')) {
    return undefined;
  }

  coreRolloutHelpersPromise ??= import('@mastra/core/agent')
    .then(mod => {
      const maybeHelpers = mod as typeof mod & Partial<CoreRolloutHelpers>;
      if (
        typeof maybeHelpers.resolveVersionFromRollout === 'function' &&
        typeof maybeHelpers.queryRolloutScoreStats === 'function'
      ) {
        return {
          resolveVersionFromRollout: maybeHelpers.resolveVersionFromRollout,
          queryRolloutScoreStats: maybeHelpers.queryRolloutScoreStats,
        };
      }
      return undefined;
    })
    .catch(() => undefined);

  return coreRolloutHelpersPromise;
}

export interface RolloutScoreStats {
  avg: number | null;
  count: number;
}

/** Hash a string pair into a bucket in [0, 1). FNV-1a inspired. */
export function deterministicBucket(routingValue: string, agentId: string): number {
  const input = `${routingValue}:${agentId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}

/** Pick a versionId from allocations for a bucket value in [0, 1). */
export function pickAllocation(allocations: RolloutAllocation[], bucket: number): string {
  if (!allocations.length) {
    throw new Error('Cannot pick allocation from empty array');
  }
  let cumulative = 0;
  for (const alloc of allocations) {
    cumulative += alloc.weight;
    if (bucket < cumulative) {
      return alloc.versionId;
    }
  }
  return allocations[allocations.length - 1]!.versionId;
}

function resolveVersionFromRolloutLocal(
  rollout: RolloutRecord,
  requestContext?: { get(key: string): unknown },
): string {
  const routingKey = rollout.routingKey ?? 'resourceId';
  const routingValue = requestContext?.get(routingKey);

  if (!routingValue || typeof routingValue !== 'string') {
    return rollout.stableVersionId;
  }

  const bucket = deterministicBucket(routingValue, rollout.agentId);
  return pickAllocation(rollout.allocations, bucket);
}

/** Resolve which version a request should use based on rollout allocations. */
export async function resolveVersionFromRollout(
  rollout: RolloutRecord,
  requestContext?: { get(key: string): unknown },
): Promise<string> {
  const coreHelpers = await loadCoreRolloutHelpers();
  return (coreHelpers?.resolveVersionFromRollout ?? resolveVersionFromRolloutLocal)(rollout, requestContext);
}

/**
 * Query average and count for scores attributed to a specific version within
 * the active rollout window using the observability OLAP aggregate API.
 */
async function queryRolloutScoreStatsLocal(
  observability: ObservabilityStorage,
  agentId: string,
  versionId: string,
  scorerId: string,
  rolloutCreatedAt: Date,
): Promise<RolloutScoreStats> {
  const filters = {
    entityName: agentId,
    entityVersionId: versionId,
    timestamp: { start: rolloutCreatedAt },
  } as const;

  const [avgRes, countRes] = await Promise.all([
    observability.getScoreAggregate({ scorerId, aggregation: 'avg', filters }),
    observability.getScoreAggregate({ scorerId, aggregation: 'count', filters }),
  ]);

  const count = typeof countRes.value === 'number' ? countRes.value : 0;
  const avg = typeof avgRes.value === 'number' ? avgRes.value : null;
  return { avg, count };
}

export async function queryRolloutScoreStats(
  observability: ObservabilityStorage,
  agentId: string,
  versionId: string,
  scorerId: string,
  rolloutCreatedAt: Date,
): Promise<RolloutScoreStats> {
  const coreHelpers = await loadCoreRolloutHelpers();
  return (coreHelpers?.queryRolloutScoreStats ?? queryRolloutScoreStatsLocal)(
    observability,
    agentId,
    versionId,
    scorerId,
    rolloutCreatedAt,
  );
}

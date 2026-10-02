import {
  executeRetentionPrune,
  resolveRetentionTargets,
  retentionCutoffMs,
  runRetentionBatches,
} from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  PruneOptions,
  PruneResult,
  RetentionPruneTarget,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import type { LibSQLDB } from './db';

export type PruneTarget = RetentionPruneTarget<TABLE_NAMES>;

async function ensureAnchorIndex(
  db: LibSQLDB,
  target: PruneTarget,
  logger?: { warn?: (msg: string, err?: unknown) => void },
): Promise<void> {
  if (!target.indexed) return;
  try {
    await db.ensureIndex({
      indexName: `idx_retention_${target.table}_${target.column}`,
      tableName: target.table,
      column: target.column,
    });
  } catch (error) {
    logger?.warn?.(`Failed to ensure retention index on ${target.table}(${target.column}):`, error);
  }
}

export function cutoffFor(policy: TableRetentionPolicy, anchorType: 'timestamp' | 'epoch-ms', now = Date.now()) {
  const cutoffMs = retentionCutoffMs(policy, now);
  return anchorType === 'epoch-ms' ? cutoffMs : new Date(cutoffMs).toISOString();
}

export const runBatchedDelete = runRetentionBatches;

export function runPrune({
  db,
  domain,
  targets,
  options,
  logger,
}: {
  db: LibSQLDB;
  domain: string;
  targets: PruneTarget[];
  options?: PruneOptions;
  logger?: { warn?: (msg: string, err?: unknown) => void };
}): Promise<PruneResult[]> {
  return executeRetentionPrune({
    domain,
    targets,
    options,
    beforeTarget: target => ensureAnchorIndex(db, target, logger),
    cutoffFor: (target, now) => cutoffFor(target.policy, target.anchorType ?? 'timestamp', now),
    deleteBatch: (target, cutoff, limit) =>
      db.pruneBatch({ tableName: target.table, column: target.column, cutoff, limit }),
  });
}

export function resolveTargets({
  policies,
  descriptor,
  order,
}: {
  policies: Record<string, TableRetentionPolicy>;
  descriptor: Record<
    string,
    { table: string; column: string; indexed: boolean; anchorType?: 'timestamp' | 'epoch-ms' }
  >;
  order: string[];
}): PruneTarget[] {
  return resolveRetentionTargets<TABLE_NAMES>({ policies, descriptor, order });
}

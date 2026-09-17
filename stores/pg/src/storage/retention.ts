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
import type { PgDB } from './db';

export type PruneTarget = RetentionPruneTarget<TABLE_NAMES>;

export function cutoffFor(policy: TableRetentionPolicy, anchorType: 'timestamp' | 'epoch-ms', now = Date.now()) {
  const cutoffMs = retentionCutoffMs(policy, now);
  return anchorType === 'epoch-ms' ? cutoffMs : new Date(cutoffMs);
}

export const runBatchedDelete = runRetentionBatches;

export function runPrune({
  db,
  domain,
  targets,
  options,
}: {
  db: PgDB;
  domain: string;
  targets: PruneTarget[];
  options?: PruneOptions;
}): Promise<PruneResult[]> {
  return executeRetentionPrune({
    domain,
    targets,
    options,
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

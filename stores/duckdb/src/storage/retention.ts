import {
  executeRetentionPrune,
  resolveRetentionTargets,
  retentionCutoffMs,
  runRetentionBatches,
} from '@mastra/core/storage';
import type { PruneOptions, PruneResult, RetentionPruneTarget, TableRetentionPolicy } from '@mastra/core/storage';

import type { DuckDBConnection } from './db';

type PruneTarget = RetentionPruneTarget<string>;

export function cutoffFor(policy: TableRetentionPolicy, now = Date.now()): Date {
  return new Date(retentionCutoffMs(policy, now));
}

export const runBatchedDelete = runRetentionBatches;

export function runPrune({
  db,
  domain,
  targets,
  options,
}: {
  db: DuckDBConnection;
  domain: string;
  targets: PruneTarget[];
  options?: PruneOptions;
}): Promise<PruneResult[]> {
  return executeRetentionPrune({
    domain,
    targets,
    options,
    cutoffFor: target => cutoffFor(target.policy),
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
  descriptor: Record<string, { table: string; column: string; indexed: boolean }>;
  order: string[];
}): PruneTarget[] {
  return resolveRetentionTargets({ policies, descriptor, order });
}

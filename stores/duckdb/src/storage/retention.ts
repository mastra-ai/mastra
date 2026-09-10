import { parseDuration } from '@mastra/core/storage';
import type { PruneOptions, PruneResult, TableRetentionPolicy } from '@mastra/core/storage';

import type { DuckDBConnection } from './db';

const DEFAULT_BATCH_SIZE = 1000;

interface PruneTarget {
  table: string;
  column: string;
  policy: TableRetentionPolicy;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function cutoffFor(policy: TableRetentionPolicy, now = Date.now()): Date {
  return new Date(now - parseDuration(policy.maxAge));
}

export async function runBatchedDelete({
  deleteBatch,
  batchSize,
  options,
}: {
  deleteBatch: (limit: number) => Promise<number>;
  batchSize: number;
  options?: PruneOptions;
}): Promise<{ deleted: number; done: boolean }> {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error(`retention batchSize must be a positive integer; received ${batchSize}`);
  }

  let deleted = 0;
  let batches = 0;

  while (true) {
    if (options?.signal?.aborted) return { deleted, done: false };
    if (options?.maxBatches !== undefined && batches >= options.maxBatches) return { deleted, done: false };

    let limit = batchSize;
    if (options?.maxRows !== undefined) {
      const remaining = options.maxRows - deleted;
      if (remaining <= 0) return { deleted, done: false };
      limit = Math.min(limit, remaining);
    }

    const affected = await deleteBatch(limit);
    deleted += affected;
    batches += 1;

    if (affected < limit) return { deleted, done: true };

    if (options?.pauseMs) {
      await sleep(options.pauseMs, options.signal);
    }
  }
}

export async function runPrune({
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
  const results: PruneResult[] = [];
  const now = Date.now();

  for (const target of targets) {
    if (options?.signal?.aborted) {
      results.push({ domain, table: target.table, deleted: 0, done: false });
      continue;
    }

    const cutoff = cutoffFor(target.policy, now);
    const batchSize = target.policy.batchSize ?? DEFAULT_BATCH_SIZE;
    const { deleted, done } = await runBatchedDelete({
      deleteBatch: limit => db.pruneBatch({ tableName: target.table, column: target.column, cutoff, limit }),
      batchSize,
      options,
    });

    results.push({ domain, table: target.table, deleted, done });
  }

  return results;
}

export function resolveTargets({
  policies,
  descriptor,
  order,
}: {
  policies: Record<string, TableRetentionPolicy>;
  descriptor: Record<string, { table: string; column: string }>;
  order: string[];
}): PruneTarget[] {
  const targets: PruneTarget[] = [];
  for (const key of order) {
    const policy = policies[key];
    const entry = descriptor[key];
    if (!policy || !entry) continue;
    targets.push({ table: entry.table, column: entry.column, policy });
  }
  return targets;
}

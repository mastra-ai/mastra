import { parseDuration } from '@mastra/core/storage';
import type { TABLE_NAMES, PruneOptions, PruneResult, TableRetentionPolicy } from '@mastra/core/storage';
import type { LibSQLDB } from './db';

const DEFAULT_BATCH_SIZE = 1000;

/** One table to prune, resolved from a policy + the domain's descriptor. */
export interface PruneTarget {
  /** Physical table name. */
  table: TABLE_NAMES;
  /** Timestamp anchor column for the age comparison. */
  column: string;
  /**
   * How the anchor column stores time, which decides how the cutoff is bound:
   * - `timestamp` (default): ISO-8601 string comparison.
   * - `epoch-ms`: raw millisecond number comparison (e.g. `schedules.triggers`).
   */
  anchorType: 'timestamp' | 'epoch-ms';
  /** Retention policy (maxAge + optional batchSize). */
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

/**
 * Runs the bounded, batched, cancellable delete loop for a set of tables in the
 * given order (callers pass children before parents for cascade-safe pruning),
 * and returns one {@link PruneResult} per table.
 *
 * The loop:
 * - deletes in chunks of `batchSize` (default 1000), each its own statement;
 * - stops a table's loop when a batch deletes fewer rows than requested (drained),
 *   or when `maxBatches`/`maxRows` is hit, or the `signal` aborts — the latter
 *   three leave `done: false` so the caller can resume;
 * - pauses `pauseMs` between batches when set, to avoid starving live traffic.
 *
 * `prune()` only deletes rows; it never reclaims disk. Freed pages are reused
 * by future writes so the file stops growing. Handing disk back to the OS is
 * left to the underlying database and the operator to manage.
 */
/** Convert a policy's `maxAge` into a cutoff bound matching the anchor's storage type. */
export function cutoffFor(policy: TableRetentionPolicy, anchorType: 'timestamp' | 'epoch-ms', now = Date.now()) {
  const cutoffMs = now - parseDuration(policy.maxAge);
  return anchorType === 'epoch-ms' ? cutoffMs : new Date(cutoffMs).toISOString();
}

/**
 * Run the bounded/cancellable batched-delete loop for a single logical target,
 * delegating the actual delete of up to `limit` rows to `deleteBatch`. Returns
 * `{ deleted, done }`; `done: false` means the loop stopped on a bound or the
 * abort signal and eligible rows may remain.
 */
export async function runBatchedDelete({
  deleteBatch,
  batchSize,
  options,
}: {
  deleteBatch: (limit: number) => Promise<number>;
  batchSize: number;
  options?: PruneOptions;
}): Promise<{ deleted: number; done: boolean }> {
  // A non-positive batch size would make every batch delete 0 rows while never
  // reaching the drained exit (`affected < limit` is false for 0 < 0) — an
  // infinite loop. Reject it up front instead of spinning.
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error(`retention batchSize must be a positive integer; received ${batchSize}`);
  }

  let deleted = 0;
  let batches = 0;

  while (true) {
    if (options?.signal?.aborted) return { deleted, done: false };
    if (options?.maxBatches !== undefined && batches >= options.maxBatches) return { deleted, done: false };

    // Never delete past the per-call row cap.
    let limit = batchSize;
    if (options?.maxRows !== undefined) {
      const remaining = options.maxRows - deleted;
      if (remaining <= 0) return { deleted, done: false };
      limit = Math.min(limit, remaining);
    }

    const affected = await deleteBatch(limit);
    deleted += affected;
    batches += 1;

    // Fewer rows than asked for => drained of eligible rows.
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
  db: LibSQLDB;
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

    const cutoff = cutoffFor(target.policy, target.anchorType, now);
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

/**
 * Resolve a domain's `{ tableKey: policy }` map plus its descriptor into an
 * ordered list of {@link PruneTarget}s. `order` lists table keys children-first
 * so cascade-dependent rows are removed before their parents. Table keys not in
 * `policies` are skipped (unset = keep forever).
 */
export function resolveTargets({
  policies,
  descriptor,
  order,
}: {
  policies: Record<string, TableRetentionPolicy>;
  descriptor: Record<string, { table: string; column: string; anchorType?: 'timestamp' | 'epoch-ms' }>;
  order: string[];
}): PruneTarget[] {
  const targets: PruneTarget[] = [];
  for (const key of order) {
    const policy = policies[key];
    const entry = descriptor[key];
    if (!policy || !entry) continue;
    targets.push({
      table: entry.table as TABLE_NAMES,
      column: entry.column,
      anchorType: entry.anchorType ?? 'timestamp',
      policy,
    });
  }
  return targets;
}

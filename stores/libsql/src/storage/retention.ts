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
  /** Retention policy (maxAge + optional batchSize). */
  policy: TableRetentionPolicy;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
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
 * by future writes so the file stops growing. Shrinking the file is the
 * separate, user-invoked `vacuum()`.
 */
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

    // Anchors are stored as ISO-8601 strings (see memory/observability domains),
    // which sort lexicographically in chronological order — so the cutoff is an
    // ISO string, not epoch ms.
    const cutoff = new Date(now - parseDuration(target.policy.maxAge)).toISOString();
    const batchSize = target.policy.batchSize ?? DEFAULT_BATCH_SIZE;

    let deleted = 0;
    let batches = 0;
    let done = true;

    while (true) {
      if (options?.signal?.aborted) {
        done = false;
        break;
      }
      if (options?.maxBatches !== undefined && batches >= options.maxBatches) {
        done = false;
        break;
      }

      // Never delete past the per-call row cap.
      let limit = batchSize;
      if (options?.maxRows !== undefined) {
        const remaining = options.maxRows - deleted;
        if (remaining <= 0) {
          done = false;
          break;
        }
        limit = Math.min(limit, remaining);
      }

      const affected = await db.pruneBatch({ tableName: target.table, column: target.column, cutoff, limit });
      deleted += affected;
      batches += 1;

      // Fewer rows than asked for => the table is drained of eligible rows.
      if (affected < limit) {
        done = true;
        break;
      }

      if (options?.pauseMs) {
        await sleep(options.pauseMs, options.signal);
      }
    }

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
  descriptor: Record<string, { table: string; column: string }>;
  order: string[];
}): PruneTarget[] {
  const targets: PruneTarget[] = [];
  for (const key of order) {
    const policy = policies[key];
    const entry = descriptor[key];
    if (!policy || !entry) continue;
    targets.push({ table: entry.table as TABLE_NAMES, column: entry.column, policy });
  }
  return targets;
}

import { parseDuration } from '@mastra/core/storage';
import type { TABLE_NAMES, PruneOptions, PruneResult, TableRetentionPolicy } from '@mastra/core/storage';

import type { MongoDBConnector } from './connectors/MongoDBConnector';

export const DEFAULT_PRUNE_BATCH_SIZE = 1000;

/**
 * How a collection physically stores its anchor value. MongoDB is schemaless,
 * so the cutoff bound must match the stored representation exactly or the
 * `$lt` comparison silently matches nothing (query operators are
 * type-bracketed):
 * - `date` (default): a BSON `Date` (memory, scores, notifications, workflows, spans).
 * - `iso`: an ISO-8601 string, e.g. `background_tasks.completedAt` is written
 *   via `toISOString()`. Lexicographic `$lt` on ISO strings is time-ordered.
 * - `epoch-ms`: a raw millisecond number, e.g. `schedule_triggers.actual_fire_at`.
 */
export type AnchorEncoding = 'date' | 'iso' | 'epoch-ms';

/** One collection to prune, resolved from a policy + the domain's descriptor. */
export interface PruneTarget {
  /** Physical collection name. */
  table: TABLE_NAMES;
  /** Anchor field for the age comparison. */
  column: string;
  /** Stored representation of the anchor field (decides the cutoff's type). */
  encoding: AnchorEncoding;
  /** Whether the anchor field should get a supporting index before pruning. */
  indexed: boolean;
  /** Retention policy (maxAge + optional batchSize). */
  policy: TableRetentionPolicy;
}

type RetentionLogger = { warn?: (msg: string, err?: unknown) => void };

/**
 * Lazily create the single-field anchor index a prune target relies on.
 * Called from the prune path (not init) so only deployments that actually
 * configure retention pay the index's write/disk overhead. Intentionally
 * ignores `skipDefaultIndexes`: retention is an explicit opt-in feature, so
 * its index is not part of the default set. Best-effort: a failure is logged
 * and pruning proceeds (correct, just slower). `createIndex` is idempotent,
 * so anchors already covered by a default single-field index are a no-op.
 */
export async function ensureAnchorIndex(
  connector: MongoDBConnector,
  target: Pick<PruneTarget, 'table' | 'column' | 'indexed'>,
  logger?: RetentionLogger,
): Promise<void> {
  if (!target.indexed) return;
  try {
    const collection = await connector.getCollection(target.table);
    await collection.createIndex({ [target.column]: -1 });
  } catch (error) {
    logger?.warn?.(`Failed to ensure retention index on ${target.table}(${target.column}):`, error);
  }
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
 * Convert a policy's `maxAge` into a cutoff bound matching the anchor's stored
 * representation (see {@link AnchorEncoding}).
 */
export function cutoffFor(policy: TableRetentionPolicy, encoding: AnchorEncoding, now = Date.now()) {
  const cutoffMs = now - parseDuration(policy.maxAge);
  if (encoding === 'epoch-ms') return cutoffMs;
  if (encoding === 'iso') return new Date(cutoffMs).toISOString();
  return new Date(cutoffMs);
}

/**
 * Delete up to `limit` documents whose anchor field is older than `cutoff`.
 *
 * `deleteMany` has no limit clause, so each batch first collects `_id`s with a
 * bounded `find`, then deletes exactly that set — the Mongo equivalent of the
 * SQL stores' `DELETE ... WHERE rowid/ctid IN (SELECT ... LIMIT n)` pattern.
 */
export async function pruneCollectionBatch({
  connector,
  table,
  column,
  cutoff,
  limit,
}: {
  connector: MongoDBConnector;
  table: TABLE_NAMES;
  column: string;
  cutoff: Date | string | number;
  limit: number;
}): Promise<number> {
  const collection = await connector.getCollection(table);
  const docs = await collection
    .find({ [column]: { $lt: cutoff } })
    .project({ _id: 1 })
    .limit(limit)
    .toArray();
  if (docs.length === 0) return 0;
  const result = await collection.deleteMany({ _id: { $in: docs.map(doc => doc._id) } });
  return result.deletedCount;
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

/**
 * Runs the bounded, batched, cancellable delete loop for a set of collections
 * in the given order (callers pass children before parents for cascade-safe
 * pruning), and returns one {@link PruneResult} per collection.
 *
 * The loop:
 * - deletes in chunks of `batchSize` (default 1000), each a bounded
 *   `find(_id)` + `deleteMany(_id $in ...)` pair;
 * - stops a collection's loop when a batch deletes fewer rows than requested
 *   (drained), or when `maxBatches`/`maxRows` is hit, or the `signal` aborts —
 *   the latter three leave `done: false` so the caller can resume;
 * - pauses `pauseMs` between batches when set, to avoid starving live traffic.
 *
 * `prune()` only deletes documents; it never reclaims disk. WiredTiger reuses
 * freed space for subsequent writes, so collections stop growing. Returning
 * disk to the OS (e.g. `compact`) is left to the operator.
 */
export async function runPrune({
  connector,
  domain,
  targets,
  options,
  logger,
}: {
  connector: MongoDBConnector;
  domain: string;
  targets: PruneTarget[];
  options?: PruneOptions;
  logger?: RetentionLogger;
}): Promise<PruneResult[]> {
  const results: PruneResult[] = [];
  const now = Date.now();

  for (const target of targets) {
    if (options?.signal?.aborted) {
      results.push({ domain, table: target.table, deleted: 0, done: false });
      continue;
    }

    await ensureAnchorIndex(connector, target, logger);

    const cutoff = cutoffFor(target.policy, target.encoding, now);
    const batchSize = target.policy.batchSize ?? DEFAULT_PRUNE_BATCH_SIZE;

    const { deleted, done } = await runBatchedDelete({
      deleteBatch: limit =>
        pruneCollectionBatch({ connector, table: target.table, column: target.column, cutoff, limit }),
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
 *
 * `encodings` overrides the stored anchor representation per table key when it
 * differs from what the core descriptor's `anchorType` implies (`epoch-ms` →
 * `epoch-ms`, otherwise a BSON `date`). MongoDB-only concern: e.g.
 * `background_tasks.completedAt` is stored as an ISO string.
 */
export function resolveTargets({
  policies,
  descriptor,
  order,
  encodings,
}: {
  policies: Record<string, TableRetentionPolicy>;
  descriptor: Record<
    string,
    { table: string; column: string; anchorType?: 'timestamp' | 'epoch-ms'; indexed?: boolean }
  >;
  order: string[];
  encodings?: Record<string, AnchorEncoding>;
}): PruneTarget[] {
  const targets: PruneTarget[] = [];
  for (const key of order) {
    const policy = policies[key];
    const entry = descriptor[key];
    if (!policy || !entry) continue;
    targets.push({
      table: entry.table as TABLE_NAMES,
      column: entry.column,
      encoding: encodings?.[key] ?? (entry.anchorType === 'epoch-ms' ? 'epoch-ms' : 'date'),
      indexed: entry.indexed ?? true,
      policy,
    });
  }
  return targets;
}

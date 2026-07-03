/**
 * Age-based retention for the v-next Postgres observability domain.
 *
 * The signal tables are insert-only and day-partitioned (native declarative
 * partitions, pg_partman-managed partitions, or Timescale chunks), so
 * retention here is NOT the row-level batched `DELETE` used by the other
 * domains — it expires data the way the partition skeleton was designed for:
 *
 *  - native / partman: `DETACH PARTITION` + `DROP TABLE` for every child
 *    partition whose upper bound is at or before the cutoff. Detach-then-drop
 *    keeps the parent lock window short, and dropping a whole day of events
 *    is O(1) — no dead tuples, no WAL churn, no vacuum debt.
 *  - timescale: `drop_chunks(older_than => cutoff)`, the Timescale-native
 *    equivalent (only chunks wholly older than the cutoff are dropped).
 *
 * Because only *whole* partitions/chunks are dropped, the effective
 * granularity is one day: rows stay until the full day they belong to has
 * aged past `maxAge`. Empty future partitions (pre-created for routing) have
 * upper bounds in the future and are never touched.
 *
 * `PruneOptions` map onto partition drops: each dropped partition counts as
 * one batch (`maxBatches` caps partitions dropped per table per call),
 * `maxRows` stops before a drop that would exceed the row budget, and the
 * abort signal is checked between drops. `deleted` reports the number of
 * rows in the dropped partitions/chunks.
 */

import { parseDuration } from '@mastra/core/storage';
import type { PruneOptions, TableRetentionPolicy } from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { qualifiedName, qualifiedTable } from './ddl';

export interface PartitionPruneOutcome {
  deleted: number;
  done: boolean;
}

/** A child partition of a signal table, with its parsed upper time bound. */
interface ChildPartition {
  name: string;
  upperBound: Date;
}

/** Convert a policy's `maxAge` into a cutoff `Date`. */
export function retentionCutoff(policy: TableRetentionPolicy, now = Date.now()): Date {
  return new Date(now - parseDuration(policy.maxAge));
}

/**
 * Lists the child partitions of `table` along with their upper range bound,
 * parsed from `pg_get_expr(relpartbound)`. Children without a parseable
 * range bound (e.g. a DEFAULT partition) are skipped — we can't prove all
 * their rows are old, so they are never dropped.
 */
async function listChildPartitions(client: DbClient, schema: string, table: string): Promise<ChildPartition[]> {
  const rows = await client.manyOrNone<{ name: string; bound: string | null }>(
    `SELECT c.relname AS "name", pg_get_expr(c.relpartbound, c.oid) AS "bound"
     FROM pg_inherits i
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = $1 AND p.relname = $2`,
    [schema, table],
  );

  const partitions: ChildPartition[] = [];
  for (const row of rows ?? []) {
    // Bound expression looks like: FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-07-02 00:00:00+00')
    const match = /TO \('([^']+)'\)/.exec(row.bound ?? '');
    if (!match?.[1]) continue;
    const upperBound = new Date(match[1]);
    if (Number.isNaN(upperBound.getTime())) continue;
    partitions.push({ name: row.name, upperBound });
  }
  return partitions.sort((a, b) => a.upperBound.getTime() - b.upperBound.getTime());
}

/**
 * Drops every child partition of `table` whose upper bound is at or before
 * `cutoff` (i.e. every row in it is provably older than the cutoff).
 * Detaches first so the parent's ACCESS EXCLUSIVE window is a fast catalog
 * change, then drops the detached table. Used for both native and
 * pg_partman-managed partitions (partman children are ordinary declarative
 * partitions; partman's own retention does the same detach+drop).
 */
export async function prunePartitionedTable({
  client,
  schema,
  table,
  cutoff,
  options,
}: {
  client: DbClient;
  schema: string;
  table: string;
  cutoff: Date;
  options?: PruneOptions;
}): Promise<PartitionPruneOutcome> {
  const partitions = await listChildPartitions(client, schema, table);
  const droppable = partitions.filter(p => p.upperBound.getTime() <= cutoff.getTime());

  let deleted = 0;
  let batches = 0;

  for (const partition of droppable) {
    if (options?.signal?.aborted) return { deleted, done: false };
    if (options?.maxBatches !== undefined && batches >= options.maxBatches) return { deleted, done: false };
    if (options?.maxRows !== undefined && deleted >= options.maxRows) return { deleted, done: false };

    const child = qualifiedName(schema, partition.name);
    const parent = qualifiedTable(schema, table);

    const row = await client.one<{ n: number }>(`SELECT count(*)::int AS "n" FROM ${child}`);

    // Detach first: a fast catalog-only lock on the parent, after which the
    // child is a plain table that can be dropped without touching the parent.
    await client.none(`ALTER TABLE ${parent} DETACH PARTITION ${child}`);
    await client.none(`DROP TABLE IF EXISTS ${child}`);

    deleted += row.n;
    batches += 1;
  }

  return { deleted, done: true };
}

/**
 * Drops every Timescale chunk of `table` wholly older than `cutoff` via
 * `drop_chunks()`. Row counts are taken from the eligible chunks (reported by
 * `show_chunks()`) before the drop. The whole `drop_chunks()` call is a
 * single batch: it either runs or is skipped when `maxBatches` is 0 or the
 * signal is already aborted.
 */
export async function pruneTimescaleTable({
  client,
  schema,
  table,
  cutoff,
  options,
}: {
  client: DbClient;
  schema: string;
  table: string;
  cutoff: Date;
  options?: PruneOptions;
}): Promise<PartitionPruneOutcome> {
  if (options?.signal?.aborted || options?.maxBatches === 0) return { deleted: 0, done: false };

  const tableExpr = qualifiedTable(schema, table);

  const chunks = await client.manyOrNone<{ chunk: string }>(
    `SELECT show_chunks($1::regclass, older_than => $2::timestamptz)::text AS "chunk"`,
    [tableExpr, cutoff.toISOString()],
  );

  let deleted = 0;
  for (const { chunk } of chunks ?? []) {
    // Chunk names come from show_chunks() as already-qualified regclass text.
    const row = await client.one<{ n: number }>(`SELECT count(*)::int AS "n" FROM ${chunk}`);
    deleted += row.n;
  }

  await client.none(`SELECT drop_chunks($1::regclass, older_than => $2::timestamptz)`, [
    tableExpr,
    cutoff.toISOString(),
  ]);

  return { deleted, done: true };
}

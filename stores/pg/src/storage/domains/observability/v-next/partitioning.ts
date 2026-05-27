/**
 * Partition + extension management for the v-next Postgres observability domain.
 *
 * Three modes (auto-detected at init unless overridden by config):
 *
 *  1. TimescaleDB present  → call `create_hypertable()` for each signal table.
 *                            Chunks are created automatically; we never
 *                            pre-create partitions and never call pg_partman.
 *
 *  2. pg_partman present   → register each signal table as a daily-partitioned
 *                            parent and let partman maintain future partitions.
 *
 *  3. Neither extension    → pre-create a rolling window of daily partitions
 *                            (yesterday + today + N future days). Future
 *                            partitions can be extended by a separate Mastra
 *                            CLI command, which is also the surface that will
 *                            implement retention cleanup.
 *
 * This module deliberately does not implement retention deletes / drops.
 * The goal here is to leave the schema in a shape that a follow-up
 * `mastra retention` command can act on without further migrations.
 */

import type { DbClient } from '../../../client';
import { ALL_SIGNAL_TABLES, qualifiedName, qualifiedTable, SIGNAL_TIME_COLUMN } from './ddl';

export type PartitionMode = 'timescale' | 'partman' | 'native';

export interface PartitioningOptions {
  /** Override auto-detection. */
  mode?: PartitionMode | 'auto';
  /**
   * Number of future daily partitions to pre-create when running in 'native'
   * mode. Default 14. Has no effect in timescale or partman modes.
   */
  futureDays?: number;
  /**
   * Whether to pre-create a partition for yesterday (covers small clock skew
   * and late-arriving events). Default true.
   */
  includeYesterday?: boolean;
}

const DEFAULT_FUTURE_DAYS = 14;

// ---------------------------------------------------------------------------
// Extension detection
// ---------------------------------------------------------------------------

export async function detectTimescale(client: DbClient): Promise<boolean> {
  const row = await client.oneOrNone<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') AS "exists"`,
  );
  return Boolean(row?.exists);
}

export async function detectPartman(client: DbClient): Promise<boolean> {
  const row = await client.oneOrNone<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_partman') AS "exists"`,
  );
  return Boolean(row?.exists);
}

export async function getPartmanVersion(client: DbClient): Promise<string | null> {
  const row = await client.oneOrNone<{ extversion: string }>(
    `SELECT extversion FROM pg_extension WHERE extname = 'pg_partman'`,
  );
  return row?.extversion ?? null;
}

function getPartmanMajor(version: string | null): number | null {
  if (!version) return null;
  const match = /^(\d+)/.exec(version);
  return match ? Number(match[1]) : null;
}

export async function resolveMode(client: DbClient, options: PartitioningOptions = {}): Promise<PartitionMode> {
  if (options.mode && options.mode !== 'auto') return options.mode;
  if (await detectTimescale(client)) return 'timescale';
  if (await detectPartman(client)) return 'partman';
  return 'native';
}

// ---------------------------------------------------------------------------
// Native daily partition helpers
// ---------------------------------------------------------------------------

function dayBounds(d: Date): { start: string; end: string; suffix: string } {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const start = `${year}-${month}-${day} 00:00:00+00`;
  const next = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate() + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  const end = `${ny}-${nm}-${nd} 00:00:00+00`;
  return { start, end, suffix: `${year}${month}${day}` };
}

function partitionName(table: string, suffix: string): string {
  return `${table}_p${suffix}`;
}

/**
 * Creates daily partition tables in [today - 1 day, today + futureDays].
 * Idempotent: uses CREATE TABLE IF NOT EXISTS.
 */
export async function ensureNativePartitions(
  client: DbClient,
  schema: string,
  options: PartitioningOptions = {},
): Promise<void> {
  const futureDays = options.futureDays ?? DEFAULT_FUTURE_DAYS;
  const includeYesterday = options.includeYesterday ?? true;
  const start = includeYesterday ? -1 : 0;

  for (const table of ALL_SIGNAL_TABLES) {
    for (let i = start; i <= futureDays; i++) {
      const d = new Date(Date.now() + i * 86_400_000);
      const { start: partStart, end: partEnd, suffix } = dayBounds(d);
      const childName = partitionName(table, suffix);
      const child = qualifiedName(schema, childName);
      const parent = qualifiedTable(schema, table);
      // Postgres requires partition bounds in `FOR VALUES FROM (…) TO (…)`
      // to be constant expressions at parse time — `$N` placeholders are
      // resolved at execution and so are rejected here. `partStart` /
      // `partEnd` are produced by `dayBounds()` (formatted from a JS Date)
      // and never touch user input, so the template interpolation is safe.
      await client.none(
        `CREATE TABLE IF NOT EXISTS ${child} PARTITION OF ${parent}
         FOR VALUES FROM ('${partStart}') TO ('${partEnd}')`,
      );
    }
  }
}

/**
 * Lists existing daily partitions for a signal table. Used by tests and the
 * future `mastra retention` CLI command.
 */
export async function listPartitions(client: DbClient, schema: string, table: string): Promise<string[]> {
  // Resolve the parent oid via pg_class/pg_namespace rather than casting a
  // hand-built string to regclass — regclass casts go through search_path
  // and throw on identifiers that don't resolve, even when the schema is
  // valid. The join is exact match on (nspname, relname) and works for any
  // schema regardless of search_path.
  const rows = await client.manyOrNone<{ partition: string }>(
    `SELECT inhrelid::regclass::text AS partition
     FROM pg_inherits
     WHERE inhparent = (
       SELECT c.oid
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2
     )
     ORDER BY 1`,
    [schema, table],
  );
  return rows.map(r => r.partition);
}

// ---------------------------------------------------------------------------
// Timescale hypertable setup
// ---------------------------------------------------------------------------

/**
 * Calls `create_hypertable()` for each signal table.
 *
 * Postgres declarative partitioning and Timescale hypertables are mutually
 * exclusive, so the base DDL must have been generated with TableDDLMode
 * 'timescale' (no `PARTITION BY` clause). `if_not_exists` makes this
 * idempotent across re-inits.
 */
export async function ensureTimescaleHypertables(client: DbClient, schema: string): Promise<void> {
  for (const table of ALL_SIGNAL_TABLES) {
    const tableExpr = qualifiedTable(schema, table);
    // SIGNAL_TIME_COLUMN values are hardcoded constants (`endedAt` /
    // `timestamp`). Inline them as string literals so `create_hypertable()`
    // receives a column name, not a SQL identifier from the surrounding
    // SELECT. Parameterizing this via `$N::name` has also been flaky on some
    // Timescale versions.
    const timeColumn = SIGNAL_TIME_COLUMN[table].replace(/'/g, "''");

    await client.none(
      `SELECT create_hypertable($1::regclass, '${timeColumn}', chunk_time_interval => INTERVAL '1 day', if_not_exists => true)`,
      [tableExpr],
    );
  }
}

// ---------------------------------------------------------------------------
// pg_partman setup
// ---------------------------------------------------------------------------

/**
 * Registers each signal table with pg_partman as a daily-interval parent and
 * lets partman create the child partitions.
 *
 * Retention is intentionally NOT configured here — it stays opt-in via the
 * future Mastra CLI surface.
 *
 * Prefers the pg_partman 5.x+ declarative API (`p_type := 'range'`) and keeps
 * a 4.x fallback (`p_type := 'native'`) for older installs. That lets the
 * adapter run against current arm64-friendly images without breaking existing
 * 4.x deployments.
 */
export async function ensurePartmanHypertables(client: DbClient, schema: string): Promise<void> {
  const partmanMajor = getPartmanMajor(await getPartmanVersion(client));

  for (const table of ALL_SIGNAL_TABLES) {
    const partmanRow = formatPartmanParentTable(schema, table);
    const exists = await client.oneOrNone<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM partman.part_config
         WHERE parent_table = format('%I.%I', $1::text, $2::text)
       ) AS "exists"`,
      [schema, table],
    );
    if (exists?.exists) continue;

    // Race: between the EXISTS check above and the `create_parent` call
    // below, a concurrent init in another process can register the parent
    // first. pg_partman doesn't have an `IF NOT EXISTS`-style guard, and on
    // 5.x it can also deadlock one of the callers while racing on its
    // template table. Retry once or accept success if another caller already
    // installed the parent row.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (partmanMajor != null && partmanMajor >= 5) {
          await client.none(
            `SELECT partman.create_parent(
               p_parent_table := format('%I.%I', $1::text, $2::text),
               p_control := $3,
               p_interval := '1 day',
               p_type := 'range'
             )`,
            [schema, table, SIGNAL_TIME_COLUMN[table]],
          );
        } else {
          await client.none(
            `SELECT partman.create_parent(
               p_parent_table := format('%I.%I', $1::text, $2::text),
               p_control := $3,
               p_type := 'native',
               p_interval := '1 day'
             )`,
            [schema, table, SIGNAL_TIME_COLUMN[table]],
          );
        }
        break;
      } catch (error) {
        const message = (error as { message?: string } | undefined)?.message ?? '';
        const code = (error as { code?: string } | undefined)?.code;
        const isDuplicate =
          code === '23505' ||
          /already managed by pg_partman/i.test(message) ||
          /relation .* already exists/i.test(message);
        if (isDuplicate) break;

        const isDeadlock = /deadlock detected/i.test(message);
        if (!isDeadlock) throw error;

        const registered = await client.oneOrNone<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM partman.part_config
             WHERE parent_table = $1
           ) AS "exists"`,
          [partmanRow],
        );
        if (registered?.exists) break;
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
  }
}

function formatPartmanParentTable(schema: string, table: string): string {
  return `${schema}.${table}`;
}

// ---------------------------------------------------------------------------
// Top-level dispatcher
// ---------------------------------------------------------------------------

export async function setupPartitioning(
  client: DbClient,
  schema: string,
  options: PartitioningOptions = {},
): Promise<PartitionMode> {
  const mode = await resolveMode(client, options);

  switch (mode) {
    case 'timescale':
      await ensureTimescaleHypertables(client, schema);
      return 'timescale';
    case 'partman':
      await ensurePartmanHypertables(client, schema);
      return 'partman';
    case 'native':
      await ensureNativePartitions(client, schema, options);
      return 'native';
  }
}

import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';

/**
 * Opt-in table engine configuration for ClickHouse-managed tables.
 *
 * - `{ type: 'default' }` (or omitted): emit plain `MergeTree` / `ReplacingMergeTree`.
 *   Safe on a single-node ClickHouse or on ClickHouse Cloud (which silently
 *   rewrites these to its own `Shared*` engines).
 *
 * - `{ type: 'replicated', cluster, ... }`: emit `Replicated*MergeTree` engines
 *   *and* fan DDL out across the named cluster via `ON CLUSTER 'cluster'`. Use
 *   when Mastra owns the schema and you want new tables Mastra adds to land on
 *   every replica automatically.
 *
 * - `{ type: 'replicated', externallyManagedDDL: true, ... }`: emit
 *   `Replicated*MergeTree` engines but DO NOT inject `ON CLUSTER`. Use when
 *   your deployment pipeline (Terraform, dbt, ansible, ...) is responsible for
 *   running every CREATE/ALTER on every replica.
 *
 * Exactly one of `cluster` / `externallyManagedDDL: true` MUST be provided in
 * replicated mode. Set `cluster` when Mastra should drive cluster-wide DDL;
 * set `externallyManagedDDL: true` when DDL fan-out is handled out-of-band.
 */
export type ClickhouseTableEngineConfig =
  | {
      type: 'default';
    }
  | (ClickhouseReplicatedEngineBase &
      (
        | {
            cluster: string;
            externallyManagedDDL?: false;
          }
        | {
            cluster?: undefined;
            externallyManagedDDL: true;
          }
      ));

interface ClickhouseReplicatedEngineBase {
  type: 'replicated';
  /**
   * Keeper path used by `Replicated*MergeTree` engines. Supports a `{table}`
   * placeholder; other placeholders (`{shard}`, `{database}`, `{replica}`) are
   * server-side ClickHouse macros and are passed through unchanged.
   *
   * Default: `/clickhouse/tables/{shard}/{database}/{table}`
   */
  zooPath?: string;
  /**
   * Replica name passed to `Replicated*MergeTree`. Server-side macros are
   * passed through unchanged.
   *
   * Default: `{replica}`
   */
  replica?: string;
}

const DEFAULT_ZOO_PATH = '/clickhouse/tables/{shard}/{database}/{table}';
const DEFAULT_REPLICA = '{replica}';

/**
 * Validates engine config and returns it normalized. Throws a `MastraError`
 * for invalid combinations (e.g., replicated without cluster *or*
 * externallyManagedDDL, or with both).
 *
 * Pass `undefined` to opt out (treated as `{ type: 'default' }`).
 */
export function validateEngineConfig(engine: ClickhouseTableEngineConfig | undefined): ClickhouseTableEngineConfig {
  if (!engine) return { type: 'default' };
  if (engine.type === 'default') return engine;

  if (engine.type !== 'replicated') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'ENGINE_CONFIG', 'INVALID'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: `Invalid ClickHouse engine config: unknown type ${(engine as { type: string }).type}. Expected 'default' or 'replicated'.`,
    });
  }

  const hasCluster = typeof engine.cluster === 'string' && engine.cluster.length > 0;
  const externallyManaged = engine.externallyManagedDDL === true;

  if (hasCluster && externallyManaged) {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'ENGINE_CONFIG', 'INVALID'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text:
        `Invalid ClickHouse engine config: replicated mode accepts either 'cluster' (Mastra fans out DDL via ON CLUSTER) ` +
        `or 'externallyManagedDDL: true' (your deploy pipeline runs DDL on every replica), not both.`,
    });
  }
  if (!hasCluster && !externallyManaged) {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'ENGINE_CONFIG', 'INVALID'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text:
        `Invalid ClickHouse engine config: replicated mode requires either 'cluster: "<cluster_name>"' so Mastra ` +
        `can emit ON CLUSTER DDL, or 'externallyManagedDDL: true' to declare that DDL fan-out is handled out-of-band.`,
    });
  }

  return engine;
}

export function isReplicatedMode(engine: ClickhouseTableEngineConfig): boolean {
  return engine.type === 'replicated';
}

/**
 * Engine families ClickHouse may report in `system.tables.engine`.
 *
 * - `local`: `MergeTree`, `ReplacingMergeTree`, etc.
 * - `replicated`: `ReplicatedMergeTree`, `ReplicatedReplacingMergeTree`,
 *   plus ClickHouse Cloud's `Shared*MergeTree` (treated as compatible with
 *   replicated mode because it provides equivalent replication semantics).
 */
export type EngineFamily = 'local' | 'replicated';

export function classifyEngine(engineName: string): EngineFamily {
  if (engineName.startsWith('Replicated') || engineName.startsWith('Shared')) {
    return 'replicated';
  }
  return 'local';
}

/**
 * Builds the engine clause (right-hand side of `ENGINE = …`) for a given
 * table. `baseEngine` is the engine family Mastra wants for this table —
 * `MergeTree` or `ReplacingMergeTree`, optionally with arguments
 * (`ReplacingMergeTree(updatedAt)`).
 *
 * In default mode the base engine is returned unchanged (the trailing `()`
 * is added so callers can interpolate this into existing DDL where they
 * previously used `MergeTree()` directly).
 *
 * In replicated mode the engine is wrapped: e.g.
 *   ReplacingMergeTree(updatedAt)
 *   → ReplicatedReplacingMergeTree('/keeper/path/mastra_spans', '{replica}', updatedAt)
 */
export function buildEngineClause(tableName: string, baseEngine: string, engine: ClickhouseTableEngineConfig): string {
  const trimmed = baseEngine.trim();
  const match = trimmed.match(/^(MergeTree|ReplacingMergeTree)(?:\((.*)\))?$/);
  if (!match) {
    // Unknown engine family — pass through unchanged. This keeps the helper
    // a no-op for any DDL we don't recognize rather than mangling it.
    return trimmed;
  }
  const [, name, rawArgs] = match;
  const args = rawArgs?.trim();

  if (engine.type !== 'replicated') {
    return args ? `${name}(${args})` : `${name}()`;
  }

  const zooPathTemplate = engine.zooPath ?? DEFAULT_ZOO_PATH;
  const zooPath = zooPathTemplate.includes('{table}')
    ? zooPathTemplate.replaceAll('{table}', tableName)
    : `${zooPathTemplate}/${tableName}`;
  const replica = engine.replica ?? DEFAULT_REPLICA;
  const replicatedName = name === 'ReplacingMergeTree' ? 'ReplicatedReplacingMergeTree' : 'ReplicatedMergeTree';

  const replicatedArgs = [quoteString(zooPath), quoteString(replica)];
  if (args) replicatedArgs.push(args);

  return `${replicatedName}(${replicatedArgs.join(', ')})`;
}

/**
 * Returns the ` ON CLUSTER 'name'` fragment (with a leading space, no trailing
 * space) for use inside DDL templates immediately after a table or view name.
 * Returns an empty string when no cluster is configured (default mode, or
 * replicated mode with `externallyManagedDDL: true`).
 *
 * ClickHouse syntax requires `ON CLUSTER` to follow the object name in
 * `CREATE TABLE … ON CLUSTER …`, `CREATE MATERIALIZED VIEW … ON CLUSTER …`,
 * and `ALTER TABLE … ON CLUSTER …`.
 */
export function onClusterClause(engine: ClickhouseTableEngineConfig): string {
  if (engine.type !== 'replicated') return '';
  if (!engine.cluster) return '';
  return ` ON CLUSTER ${quoteString(engine.cluster)}`;
}

function quoteString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Verifies that the engine families of any pre-existing Mastra-owned tables
 * match the configured engine mode. This blocks accidental cross-mode
 * deployments — e.g. enabling `engine: 'replicated'` against a database that
 * was originally initialized with plain `MergeTree`.
 *
 * Behavior:
 * - Tables that don't exist yet are skipped (fresh install case).
 * - Default mode + Cloud `Shared*` engines is allowed (Cloud rewrites our
 *   `ReplacingMergeTree` to `Shared*` server-side).
 * - Any other family mismatch throws a `MastraError`.
 */
export async function assertEngineFamilyMatches(
  client: ClickHouseClient,
  tableNames: readonly string[],
  engine: ClickhouseTableEngineConfig,
): Promise<void> {
  if (tableNames.length === 0) return;

  const result = await client.query({
    query: `SELECT name, engine FROM system.tables WHERE database = currentDatabase() AND name IN {names:Array(String)}`,
    query_params: { names: tableNames as string[] },
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ name: string; engine: string }>;
  if (rows.length === 0) return;

  const expected: EngineFamily = engine.type === 'replicated' ? 'replicated' : 'local';
  const mismatches: Array<{ table: string; engine: string; family: EngineFamily }> = [];

  for (const row of rows) {
    const family = classifyEngine(row.engine);
    if (family === expected) continue;
    // Tolerate ClickHouse Cloud's Shared* rewrite under default config: the
    // user asked for plain MergeTree, the server gave us Shared*MergeTree —
    // semantically equivalent for our purposes, so don't abort.
    if (expected === 'local' && row.engine.startsWith('Shared')) continue;
    mismatches.push({ table: row.name, engine: row.engine, family });
  }

  if (mismatches.length === 0) return;

  const lines = mismatches.map(m => `  - ${m.table} (${m.engine} → ${m.family})`).join('\n');
  const expectedLabel = expected === 'replicated' ? 'replicated (Replicated*MergeTree)' : 'local (plain MergeTree)';
  throw new MastraError({
    id: createStorageErrorId('CLICKHOUSE', 'ENGINE_FAMILY_MISMATCH', 'STARTUP_ABORTED'),
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text:
      `\n` +
      `===========================================================================\n` +
      `ENGINE FAMILY MISMATCH: ClickHouse tables exist with a different engine\n` +
      `  family than the configured engine mode. Refusing to start.\n` +
      `===========================================================================\n` +
      `\n` +
      `Configured engine mode: ${expectedLabel}\n` +
      `Existing tables with mismatched engine:\n` +
      `\n` +
      `${lines}\n` +
      `\n` +
      `Mastra does not migrate between engine families automatically. To resolve:\n` +
      `  - Update the 'engine' option to match the existing tables, OR\n` +
      `  - Drop the existing tables (data loss) and let Mastra recreate them in\n` +
      `    the configured engine mode.\n` +
      `===========================================================================\n`,
    details: { mismatches: JSON.stringify(mismatches) },
  });
}

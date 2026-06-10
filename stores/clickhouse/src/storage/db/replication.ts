import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';

export interface ClickhouseReplicationConfig {
  /** Optional cluster name. When set, Mastra-owned DDL is emitted with ON CLUSTER. */
  cluster?: string;
  /** Keeper path for replicated tables. Supports ClickHouse macros like {shard}, {database}, and {table}. */
  zookeeperPath?: string;
  /** Replica name. Supports ClickHouse macros like {replica}. */
  replicaName?: string;
}

const DEFAULT_ZOOKEEPER_PATH = '/clickhouse/tables/{shard}/{database}/{table}';
const DEFAULT_REPLICA_NAME = '{replica}';

const REPLICATED_ENGINE_NAMES = new Set(['ReplicatedMergeTree', 'ReplicatedReplacingMergeTree']);
const SUPPORTED_ENGINE_NAMES = new Set(['MergeTree', 'ReplacingMergeTree', ...REPLICATED_ENGINE_NAMES]);

export function isReplicationConfigured(
  replication?: ClickhouseReplicationConfig,
): replication is ClickhouseReplicationConfig {
  return replication !== undefined;
}

export function isReplicatedOrSharedEngine(engine?: string | null): boolean {
  if (!engine) return false;
  return engine.startsWith('Replicated') || engine.startsWith('Shared');
}

export function validateReplicationConfig(replication?: ClickhouseReplicationConfig): void {
  if (!replication) return;

  if (replication.cluster !== undefined && replication.cluster.trim() === '') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', 'INVALID_CLUSTER'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'ClickHouse replication.cluster must be a non-empty string when provided.',
    });
  }

  if (replication.zookeeperPath !== undefined && replication.zookeeperPath.trim() === '') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', 'INVALID_ZOOKEEPER_PATH'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'ClickHouse replication.zookeeperPath must be a non-empty string when provided.',
    });
  }

  if (replication.replicaName !== undefined && replication.replicaName.trim() === '') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', 'INVALID_REPLICA_NAME'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'ClickHouse replication.replicaName must be a non-empty string when provided.',
    });
  }
}

function quoteClickhouseString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Splits an engine clause into name and args. Assumes engine args do not
 * contain nested parentheses — true for every engine currently emitted by
 * Mastra (see TABLE_ENGINES in db/utils.ts) and for every v-next DDL. If a
 * future engine uses nested parens (e.g. `ReplacingMergeTree(ver, CAST(...))`),
 * this parser must be extended.
 */
function getEngineNameAndArgs(engine: string): { name: string; args: string } | null {
  const trimmed = engine.trim();
  const match = trimmed.match(/^(\w+)\s*(?:\((.*)\))?$/s);
  if (!match) return null;
  const name = match[1];
  if (!name) return null;
  return { name, args: match[2]?.trim() ?? '' };
}

export function buildReplicatedTableEngine(engine: string, replication?: ClickhouseReplicationConfig): string {
  if (!replication) return engine;

  const parsed = getEngineNameAndArgs(engine);
  if (!parsed || !SUPPORTED_ENGINE_NAMES.has(parsed.name)) return engine;
  if (isReplicatedOrSharedEngine(parsed.name)) return engine;

  const zookeeperPath = quoteClickhouseString(replication.zookeeperPath ?? DEFAULT_ZOOKEEPER_PATH);
  const replicaName = quoteClickhouseString(replication.replicaName ?? DEFAULT_REPLICA_NAME);
  const replicatedName = parsed.name === 'ReplacingMergeTree' ? 'ReplicatedReplacingMergeTree' : 'ReplicatedMergeTree';
  const args = [zookeeperPath, replicaName, parsed.args].filter(Boolean).join(', ');
  return `${replicatedName}(${args})`;
}

/**
 * Injects `ON CLUSTER '<cluster>'` into Mastra-owned DDL when a cluster is configured.
 *
 * Covered forms:
 *  - `CREATE TABLE [IF NOT EXISTS] <name>`
 *  - `CREATE MATERIALIZED VIEW [IF NOT EXISTS] <name>`
 *  - `ALTER TABLE <name>` (covers ADD COLUMN, ADD INDEX, MODIFY TTL, etc.)
 *  - `DROP TABLE|VIEW [IF EXISTS] <name>`
 *  - `SYSTEM REFRESH VIEW <name>` and `SYSTEM WAIT VIEW <name>`
 *
 * Not covered (intentional — these either replicate automatically on
 * ReplicatedMergeTree or should not propagate cluster-wide):
 *  - `TRUNCATE TABLE`, `OPTIMIZE TABLE`, `ALTER TABLE ... UPDATE/DELETE` (replicated)
 *  - `SYSTEM STOP/START MERGES` (intentionally local; pausing merges
 *    cluster-wide would unnecessarily stall other replicas)
 *  - `RENAME TABLE`, `EXCHANGE TABLES`, `ATTACH`, `DETACH` (not emitted by
 *    Mastra under replication; v-next signal migration that uses EXCHANGE
 *    fails fast when replication is configured)
 *
 * The `\sON\s+CLUSTER\s` guard makes each rewriter idempotent.
 */
export function addOnClusterToDDL(sql: string, replication?: ClickhouseReplicationConfig): string {
  const cluster = replication?.cluster?.trim();
  if (!cluster) return sql;

  const quotedCluster = quoteClickhouseString(cluster);
  const onClusterSuffix = ` ON CLUSTER ${quotedCluster}`;

  const rewrite = (input: string, pattern: RegExp): string => {
    return input.replace(pattern, (...args: unknown[]) => {
      const match = args[0] as string;
      // The last two trailing args are (offset, source); any others are capture groups.
      const source = args[args.length - 1] as string;
      const offset = args[args.length - 2] as number;
      const tail = source.slice(offset + match.length);
      if (/^\s+ON\s+CLUSTER\s/i.test(tail)) return match;
      return match + onClusterSuffix;
    });
  };

  let out = sql;
  out = rewrite(out, /\bCREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?[^\s(]+/gi);
  out = rewrite(out, /\bCREATE\s+MATERIALIZED\s+VIEW\s+(IF\s+NOT\s+EXISTS\s+)?[^\s(]+/gi);
  out = rewrite(out, /\bALTER\s+TABLE\s+[^\s]+/gi);
  out = rewrite(out, /\bDROP\s+(TABLE|VIEW)\s+(IF\s+EXISTS\s+)?[^\s]+/gi);
  out = rewrite(out, /\bSYSTEM\s+(REFRESH|WAIT)\s+VIEW\s+[^\s;]+/gi);
  return out;
}

export function applyReplicationToDDL(sql: string, replication?: ClickhouseReplicationConfig): string {
  const withReplicatedEngine = replication
    ? sql.replace(/ENGINE\s*=\s*(\w+\s*(?:\([^)]*\))?)/gi, (_match, engine: string) => {
        return `ENGINE = ${buildReplicatedTableEngine(engine, replication)}`;
      })
    : sql;
  return addOnClusterToDDL(withReplicatedEngine, replication);
}

export function buildLocalTableReplicationError(tables: Array<{ name: string; engine: string }>): MastraError {
  const tableList = tables.map(table => `  - ${table.name} (${table.engine})`).join('\n');
  return new MastraError({
    id: createStorageErrorId('CLICKHOUSE', 'REPLICATION', 'LOCAL_TABLES_UNSUPPORTED'),
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text:
      `ClickHouse replication is enabled, but existing Mastra tables use non-replicated local engines.\n` +
      `Mastra will not automatically convert existing local tables to replicated tables.\n` +
      `Please migrate or recreate these tables manually before enabling replication:\n${tableList}`,
  });
}

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';

export interface ClickhouseReplicationConfig {
  /** Optional cluster name. When set, Mastra-owned DDL is emitted with ON CLUSTER. */
  cluster?: string;
  /** Keeper path for replicated tables. Supports ClickHouse macros like {shard}, {database}, and {table}. */
  replicaPath?: string;
  /** Replica name. Supports ClickHouse macros like {replica}. */
  replicaName?: string;
}

const DEFAULT_REPLICA_PATH = '/clickhouse/tables/{shard}/{database}/{table}';
const DEFAULT_REPLICA_NAME = '{replica}';

const REPLICATED_ENGINE_NAMES = new Set(['ReplicatedMergeTree', 'ReplicatedReplacingMergeTree']);
const SHARED_ENGINE_NAMES = new Set(['SharedMergeTree', 'SharedReplacingMergeTree']);
const SUPPORTED_ENGINE_NAMES = new Set(['MergeTree', 'ReplacingMergeTree', ...REPLICATED_ENGINE_NAMES]);

export function isReplicationConfigured(replication?: ClickhouseReplicationConfig): replication is ClickhouseReplicationConfig {
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

  if (replication.replicaPath !== undefined && replication.replicaPath.trim() === '') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', 'INVALID_REPLICA_PATH'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'ClickHouse replication.replicaPath must be a non-empty string when provided.',
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
  if (REPLICATED_ENGINE_NAMES.has(parsed.name) || SHARED_ENGINE_NAMES.has(parsed.name)) return engine;

  const replicaPath = quoteClickhouseString(replication.replicaPath ?? DEFAULT_REPLICA_PATH);
  const replicaName = quoteClickhouseString(replication.replicaName ?? DEFAULT_REPLICA_NAME);
  const replicatedName = parsed.name === 'ReplacingMergeTree' ? 'ReplicatedReplacingMergeTree' : 'ReplicatedMergeTree';
  const args = [replicaPath, replicaName, parsed.args].filter(Boolean).join(', ');
  return `${replicatedName}(${args})`;
}

export function addOnClusterToDDL(sql: string, replication?: ClickhouseReplicationConfig): string {
  const cluster = replication?.cluster?.trim();
  if (!cluster) return sql;

  const quotedCluster = quoteClickhouseString(cluster);
  return sql
    .replace(/\bCREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi, match =>
      /\sON\s+CLUSTER\s/i.test(match) ? match : match.replace(/([^\s(]+)$/i, `$1 ON CLUSTER ${quotedCluster}`),
    )
    .replace(/\bCREATE\s+MATERIALIZED\s+VIEW\s+(IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi, match =>
      /\sON\s+CLUSTER\s/i.test(match) ? match : match.replace(/([^\s(]+)$/i, `$1 ON CLUSTER ${quotedCluster}`),
    )
    .replace(/\bALTER\s+TABLE\s+([^\s]+)/gi, match =>
      /\sON\s+CLUSTER\s/i.test(match) ? match : match.replace(/([^\s]+)$/i, `$1 ON CLUSTER ${quotedCluster}`),
    )
    .replace(/\bDROP\s+(TABLE|VIEW)\s+(IF\s+EXISTS\s+)?([^\s]+)/gi, match =>
      /\sON\s+CLUSTER\s/i.test(match) ? match : match.replace(/([^\s]+)$/i, `$1 ON CLUSTER ${quotedCluster}`),
    );
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

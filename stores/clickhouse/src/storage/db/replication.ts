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

function assertReplicationConfigField(
  fieldName: 'cluster' | 'zookeeperPath' | 'replicaName',
  value: string | undefined,
  errorCode: 'INVALID_CLUSTER' | 'INVALID_ZOOKEEPER_PATH' | 'INVALID_REPLICA_NAME',
): void {
  if (value === undefined) return;

  if (value.trim() === '') {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', errorCode),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: `ClickHouse replication.${fieldName} must be a non-empty string when provided.`,
    });
  }

  // Values get interpolated into DDL. Whitespace or quotes will fail at parse
  // time inside ClickHouse with a confusing error; reject early with a clear
  // message instead. ClickHouse macros (e.g. `{shard}`, `{replica}`) and path
  // separators are still allowed.
  if (/\s/.test(value) || value.includes("'") || value.includes('"') || value.includes('\\')) {
    throw new MastraError({
      id: createStorageErrorId('CLICKHOUSE', 'REPLICATION_CONFIG', errorCode),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: `ClickHouse replication.${fieldName} must not contain whitespace or quote characters.`,
    });
  }
}

export function validateReplicationConfig(replication?: ClickhouseReplicationConfig): void {
  if (!replication) return;

  assertReplicationConfigField('cluster', replication.cluster, 'INVALID_CLUSTER');
  assertReplicationConfigField('zookeeperPath', replication.zookeeperPath, 'INVALID_ZOOKEEPER_PATH');
  assertReplicationConfigField('replicaName', replication.replicaName, 'INVALID_REPLICA_NAME');
}

function quoteClickhouseString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Splits an engine clause into name and args. Assumes engine args do not
 * contain nested parentheses — true for every engine currently emitted by
 * Mastra (see TABLE_ENGINES in db/utils.ts) and for every v-next DDL. If a
 * future engine uses nested parens (e.g. `ReplacingMergeTree(ver, CAST(...))`),
 * this parser must be extended. As a defensive measure we balance-check the
 * captured args and bail out (returning null) on a mismatch so the rewriter
 * leaves the original engine clause untouched — invalid DDL surfaces at
 * ClickHouse parse time with the real engine instead of a silently-corrupted
 * rewrite.
 */
function getEngineNameAndArgs(engine: string): { name: string; args: string } | null {
  const trimmed = engine.trim();
  const match = trimmed.match(/^(\w+)\s*(?:\((.*)\))?$/s);
  if (!match) return null;
  const name = match[1];
  if (!name) return null;
  const args = match[2]?.trim() ?? '';
  if (args && !hasBalancedParens(args)) return null;
  return { name, args };
}

function hasBalancedParens(s: string): boolean {
  let depth = 0;
  let quote: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '`' || c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && quote === undefined;
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
 *  - `ALTER TABLE <name>` (covers ADD COLUMN, ADD INDEX, MODIFY TTL,
 *    MATERIALIZE TTL, UPDATE, DELETE, etc.)
 *  - `DROP TABLE|VIEW [IF EXISTS] <name>`
 *  - `TRUNCATE TABLE [IF EXISTS] <name>`
 *  - `OPTIMIZE TABLE <name>`
 *  - `SYSTEM REFRESH VIEW <name>` and `SYSTEM WAIT VIEW <name>`
 *
 * Several of these (TRUNCATE, ALTER UPDATE/DELETE, OPTIMIZE) replicate
 * automatically on ReplicatedMergeTree via the Keeper queue, so ON CLUSTER is
 * not strictly required for correctness. We add it anyway for two reasons:
 *  1. Consistency — when an operator sets `cluster`, maintenance commands
 *     should fan out the same way DDL does.
 *  2. Robustness — drift becomes impossible if a table is later swapped to a
 *     non-replicated engine, or someone runs the command against a node that
 *     is not yet a replica.
 *
 * Not covered (intentional — not emitted by Mastra under replication):
 *  - `RENAME TABLE`, `EXCHANGE TABLES`, `ATTACH`, `DETACH` — the v-next signal
 *    migration that uses EXCHANGE fails fast when replication is configured.
 *  - `SYSTEM STOP/START MERGES` — these are intentionally per-node. Pausing
 *    merges fleet-wide because `clearTable` wants to TRUNCATE one table is
 *    operational overreach; the per-node pause is enough since TRUNCATE
 *    itself replicates via Keeper. See `ClickhouseDB.clearTable`.
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
  out = rewrite(out, /\bTRUNCATE\s+TABLE\s+(IF\s+EXISTS\s+)?[^\s]+/gi);
  out = rewrite(out, /\bOPTIMIZE\s+TABLE\s+[^\s]+/gi);
  out = rewrite(out, /\bSYSTEM\s+(REFRESH|WAIT)\s+VIEW\s+[^\s;]+/gi);
  return out;
}

function rewriteEngineClauses(sql: string, replication: ClickhouseReplicationConfig): string {
  const enginePattern = /ENGINE\s*=\s*(\w+)/gi;
  let result = '';
  let consumedUntil = 0;

  for (let match = enginePattern.exec(sql); match; match = enginePattern.exec(sql)) {
    const engineName = match[1];
    if (!engineName) continue;

    let engineEnd = enginePattern.lastIndex;
    let argsStart = engineEnd;
    while (/\s/.test(sql[argsStart] ?? '')) argsStart++;
    let engine = engineName;

    if (sql[argsStart] === '(') {
      let depth = 0;
      let closingParenEnd: number | undefined;
      // Track quoted regions so parentheses inside quoted identifiers
      // (`col)`, "col)") or string literals ('...)') do not affect depth.
      let quote: string | undefined;
      for (let i = argsStart; i < sql.length; i++) {
        const char = sql[i];
        if (quote) {
          if (char === '\\') i++;
          else if (char === quote) quote = undefined;
          continue;
        }
        if (char === '`' || char === '"' || char === "'") {
          quote = char;
        } else if (char === '(') depth++;
        else if (char === ')') {
          depth--;
          if (depth === 0) {
            closingParenEnd = i + 1;
            break;
          }
        }
      }

      if (closingParenEnd === undefined) {
        result += sql.slice(consumedUntil, enginePattern.lastIndex);
        consumedUntil = enginePattern.lastIndex;
        continue;
      }

      engineEnd = closingParenEnd;
      engine = `${engineName}${sql.slice(argsStart, engineEnd)}`;
    }

    result += sql.slice(consumedUntil, match.index);
    result += `ENGINE = ${buildReplicatedTableEngine(engine, replication)}`;
    consumedUntil = engineEnd;
    enginePattern.lastIndex = engineEnd;
  }

  return result + sql.slice(consumedUntil);
}

export function applyReplicationToDDL(sql: string, replication?: ClickhouseReplicationConfig): string {
  const withReplicatedEngine = replication ? rewriteEngineClauses(sql, replication) : sql;
  return addOnClusterToDDL(withReplicatedEngine, replication);
}

/**
 * Guarded ClickHouse client. Every statement passes a read-only allowlist and runs with explicit
 * execution limits, a `log_comment` tag and a random `query_id`. Results are either streamed and
 * discarded (byte/row counts only) or parsed for the harness's own aggregate-only queries.
 */
import { randomUUID } from 'node:crypto';

import { ClickHouseLogLevel, createClient } from '@clickhouse/client';
import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';

import { CH_SETTINGS } from '../../src/storage/domains/observability/v-next/helpers';
import { redact } from './env';
import type { BenchCredentials } from './env';

export interface Tier {
  id: 1 | 2 | 3;
  maxExecutionTimeS: number;
  maxMemoryBytes: number;
  maxThreads: number;
  maxBytesToRead: number;
  maxResultRows: number;
}

const GiB = 1024 ** 3;
const GB = 1e9;

export const TIERS: Record<1 | 2 | 3, Tier> = {
  1: {
    id: 1,
    maxExecutionTimeS: 30,
    maxMemoryBytes: 4 * GiB,
    maxThreads: 4,
    maxBytesToRead: 50 * GB,
    maxResultRows: 20_000,
  },
  2: {
    id: 2,
    maxExecutionTimeS: 60,
    maxMemoryBytes: 8 * GiB,
    maxThreads: 8,
    maxBytesToRead: 200 * GB,
    maxResultRows: 20_000,
  },
  3: {
    id: 3,
    maxExecutionTimeS: 120,
    maxMemoryBytes: 16 * GiB,
    maxThreads: 16,
    maxBytesToRead: 500 * GB,
    maxResultRows: 20_000,
  },
};

export class StatementRejected extends Error {
  constructor(reason: string) {
    super(`Statement rejected by the read-only allowlist: ${reason}`);
    this.name = 'StatementRejected';
  }
}

const DENIED_KEYWORDS =
  /\b(INSERT|ALTER|DROP|TRUNCATE|CREATE|SYSTEM(?!\s*\.)|KILL|OPTIMIZE|RENAME|ATTACH|DETACH|GRANT|REVOKE|SET|USE|DELETE|UPDATE|EXCHANGE|UNDROP|BACKUP|RESTORE|INTO\s+OUTFILE)\b/i;

/** Only single SELECT / WITH … SELECT / EXPLAIN statements are allowed. */
export function assertReadOnlyStatement(sql: string): void {
  const trimmed = sql.trim();
  if (!/^(SELECT|WITH|EXPLAIN)\b/i.test(trimmed))
    throw new StatementRejected('must start with SELECT, WITH or EXPLAIN');
  if (trimmed.includes(';')) throw new StatementRejected('multiple statements are not allowed');
  const keyword = DENIED_KEYWORDS.exec(trimmed);
  if (keyword) throw new StatementRejected(`contains ${keyword[1]!.toUpperCase()}`);
}

export type ErrorCategory =
  | 'timeout'
  | 'memory'
  | 'too_many_bytes'
  | 'result_rows'
  | 'request_size'
  | 'overload'
  | 'other';

const LIMIT_CODES: Record<string, ErrorCategory> = {
  '159': 'timeout', // TIMEOUT_EXCEEDED
  '241': 'memory', // MEMORY_LIMIT_EXCEEDED
  '307': 'too_many_bytes', // TOO_MANY_BYTES
  '396': 'result_rows', // TOO_MANY_ROWS_OR_BYTES
};

/**
 * The HTTP interface rejects a query parameter above `http_max_field_value_size` before the query
 * runs (no ClickHouse error code). Deterministic for a given statement, so it is a limit hit.
 */
const REQUEST_SIZE_MESSAGE = /Field value too long/;

export function categorize(code: string | undefined, message?: string): ErrorCategory {
  if (!code && message && REQUEST_SIZE_MESSAGE.test(message)) return 'request_size';
  return (code && LIMIT_CODES[code]) || 'other';
}

/** Per-query limit hits. `overload` (server busy) and `other` are not limits and never escalate. */
export function isLimitCategory(category: ErrorCategory): boolean {
  return category !== 'other' && category !== 'overload';
}

/** Server-side codes meaning "the replica is busy", not "this query is too big". */
const OVERLOAD_CODES = new Set([
  '202', // TOO_MANY_SIMULTANEOUS_QUERIES
  '203', // NO_FREE_CONNECTION
  '209', // SOCKET_TIMEOUT
  '210', // NETWORK_ERROR
]);
const OVERLOAD_MESSAGE =
  /ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|Timeout error|\b(429|503)\b|Too Many Requests|Service Unavailable/i;

/**
 * True when a failure says the server (not the query) ran out of capacity: the codes above, a
 * transport-level failure, or a memory limit hit on the server total rather than on this query.
 * Uses the in-memory redacted message only; nothing here is persisted.
 */
export function isOverload(outcome: Pick<QueryOutcome<unknown>, 'ok' | 'errorCode' | 'errorMessage'>): boolean {
  if (outcome.ok) return false;
  if (outcome.errorCode && OVERLOAD_CODES.has(outcome.errorCode)) return true;
  const message = outcome.errorMessage ?? '';
  if (outcome.errorCode === '241') return /\(total\)|total memory limit|OvercommitTracker/i.test(message);
  return !outcome.errorCode && OVERLOAD_MESSAGE.test(message);
}

export interface ClickHouseSummary {
  read_rows?: string;
  read_bytes?: string;
  result_rows?: string;
  result_bytes?: string;
  elapsed_ns?: string;
  memory_usage?: string;
}

export interface QueryOutcome<Row = never> {
  queryId: string;
  wallMs: number;
  ok: boolean;
  /** Rows streamed back, counted without parsing (discard mode) or parsed rows' length. */
  streamedRows: number;
  streamedBytes: number;
  summary?: ClickHouseSummary;
  errorCode?: string;
  errorCategory?: ErrorCategory;
  /** Redacted, in memory only. Never persisted; printed only by the local smoke run. */
  errorMessage?: string;
  rows?: Row[];
}

export interface RunOptions {
  logComment: string;
  tier: Tier;
  /** First execution of a case: bypass the filesystem cache so data is read from object storage. */
  cold?: boolean;
  /** Override for the harness's own metadata queries (profile, query_log). */
  settings?: ClickHouseSettings;
  /** Mirrors the store: compiled queries flagged `sharedSnapshot` run with one storage snapshot. */
  sharedSnapshot?: boolean;
}

export function settingsFor(options: RunOptions): ClickHouseSettings {
  const { tier } = options;
  return {
    ...CH_SETTINGS,
    max_execution_time: tier.maxExecutionTimeS,
    timeout_overflow_mode: 'throw',
    max_memory_usage: String(tier.maxMemoryBytes),
    max_threads: tier.maxThreads,
    max_bytes_to_read: String(tier.maxBytesToRead),
    read_overflow_mode: 'throw',
    max_result_rows: String(tier.maxResultRows),
    result_overflow_mode: 'throw',
    use_query_cache: 0,
    // Buffer the (bounded) result so X-ClickHouse-Summary always reflects the finished query.
    wait_end_of_query: 1,
    log_comment: options.logComment,
    ...(options.cold ? { enable_filesystem_cache: 0 } : {}),
    ...(options.sharedSnapshot ? { enable_shared_storage_snapshot_in_query: 1 } : {}),
    ...options.settings,
  };
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return code === undefined || code === null ? undefined : String(code);
}

export class BenchClient {
  readonly #client: ClickHouseClient;

  constructor(credentials: BenchCredentials, maxOpenConnections = 1) {
    this.#client = createClient({
      url: credentials.origin,
      username: credentials.username,
      password: credentials.password,
      database: credentials.database,
      request_timeout: 180_000,
      max_open_connections: maxOpenConnections,
      compression: { response: true, request: false },
      // The client's own logger could print request details; keep it silent.
      log: { level: ClickHouseLogLevel.OFF },
    });
  }

  /** Streams the result and counts it without parsing any value. */
  discard(sql: string, params: Record<string, unknown>, options: RunOptions): Promise<QueryOutcome> {
    return this.#run(sql, params, options, false);
  }

  /** Parses the result. Only for the harness's own aggregate-only/metadata queries and page keys. */
  rows<Row>(sql: string, params: Record<string, unknown>, options: RunOptions): Promise<QueryOutcome<Row>> {
    return this.#run<Row>(sql, params, options, true);
  }

  async #run<Row>(
    sql: string,
    params: Record<string, unknown>,
    options: RunOptions,
    parse: boolean,
  ): Promise<QueryOutcome<Row>> {
    assertReadOnlyStatement(sql);
    const queryId = randomUUID();
    const started = performance.now();
    let streamedRows = 0;
    let streamedBytes = 0;
    let summary: ClickHouseSummary | undefined;
    try {
      const result = await this.#client.query({
        query: sql,
        query_params: params,
        query_id: queryId,
        format: 'JSONEachRow',
        clickhouse_settings: settingsFor(options),
      });
      const header = result.response_headers['x-clickhouse-summary'];
      let rows: Row[] | undefined;
      if (parse) {
        rows = await result.json<Row>();
        streamedRows = rows.length;
      } else {
        for await (const chunk of result.stream()) {
          for (const row of chunk as Array<{ text: string }>) {
            streamedRows += 1;
            streamedBytes += row.text.length + 1;
          }
        }
      }
      summary = typeof header === 'string' ? (JSON.parse(header) as ClickHouseSummary) : undefined;
      return { queryId, wallMs: performance.now() - started, ok: true, streamedRows, streamedBytes, summary, rows };
    } catch (error) {
      const code = errorCode(error);
      return {
        queryId,
        wallMs: performance.now() - started,
        ok: false,
        streamedRows,
        streamedBytes,
        errorCode: code,
        errorCategory: categorize(code, error instanceof Error ? error.message : String(error)),
        errorMessage: redact(error instanceof Error ? error.message : String(error)),
      };
    }
  }

  async close(): Promise<void> {
    await this.#client.close();
  }
}

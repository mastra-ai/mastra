/**
 * Server-side metrics per query from `system.query_log` (metric columns only — never `query` or
 * `query_params`), with the `X-ClickHouse-Summary` header and client wall time as fallback.
 */
import type { BenchClient, ClickHouseSummary, QueryOutcome, Tier } from './client';

export interface QueryMetrics {
  source: 'query_log' | 'summary';
  durationMs: number;
  readRows: number;
  readBytes: number;
  memoryBytes: number | null;
  resultRows: number;
  resultBytes: number;
  selectedMarks: number | null;
  selectedParts: number | null;
  exceptionCode: number;
}

interface QueryLogRow {
  type: string;
  query_duration_ms: number;
  read_rows: number;
  read_bytes: number;
  memory_usage: number;
  result_rows: number;
  result_bytes: number;
  exception_code: number;
  selected_marks: number;
  selected_parts: number;
}

export type QueryLogSource = 'cluster' | 'local' | 'none';

export function queryLogTable(source: QueryLogSource): string {
  return source === 'cluster' ? "clusterAllReplicas('default', system.query_log)" : 'system.query_log';
}

export function queryLogSql(source: QueryLogSource): string {
  return `SELECT toString(type) AS type, query_duration_ms, read_rows, read_bytes, memory_usage, result_rows, result_bytes,
  exception_code, ProfileEvents['SelectedMarks'] AS selected_marks, ProfileEvents['SelectedParts'] AS selected_parts
FROM ${queryLogTable(source)}
WHERE event_date >= yesterday() AND event_time >= now() - INTERVAL 1 HOUR
  AND query_id = {qid:String}
  AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
LIMIT 1`;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function fromSummary(outcome: QueryOutcome<unknown>): QueryMetrics {
  const s: ClickHouseSummary = outcome.summary ?? {};
  const num = (value: string | undefined) => (value === undefined ? 0 : Number(value));
  return {
    source: 'summary',
    durationMs: s.elapsed_ns ? num(s.elapsed_ns) / 1e6 : outcome.wallMs,
    readRows: num(s.read_rows),
    readBytes: num(s.read_bytes),
    memoryBytes: s.memory_usage === undefined ? null : num(s.memory_usage),
    resultRows: s.result_rows === undefined ? outcome.streamedRows : num(s.result_rows),
    resultBytes: num(s.result_bytes),
    selectedMarks: null,
    selectedParts: null,
    exceptionCode: outcome.ok ? 0 : Number(outcome.errorCode ?? -1),
  };
}

/** Polls query_log for up to `maxWaitMs` (no SYSTEM FLUSH LOGS); falls back to the summary header. */
export async function collectMetrics(
  client: BenchClient,
  source: QueryLogSource,
  outcome: QueryOutcome<unknown>,
  tier: Tier,
  logComment: string,
  maxWaitMs = 30_000,
): Promise<QueryMetrics> {
  if (source === 'none') return fromSummary(outcome);
  const deadline = Date.now() + maxWaitMs;
  let delay = 1_000;
  while (Date.now() < deadline) {
    await sleep(delay);
    const result = await client.rows<QueryLogRow>(
      queryLogSql(source),
      { qid: outcome.queryId },
      { tier, logComment, settings: { max_execution_time: 20, max_threads: 2 } },
    );
    // No access (ACCESS_DENIED / READ ON REMOTE): polling cannot succeed.
    if (!result.ok && result.errorCode === '497') break;
    const row = result.ok ? result.rows?.[0] : undefined;
    if (row) {
      return {
        source: 'query_log',
        durationMs: Number(row.query_duration_ms),
        readRows: Number(row.read_rows),
        readBytes: Number(row.read_bytes),
        memoryBytes: Number(row.memory_usage),
        resultRows: Number(row.result_rows),
        resultBytes: Number(row.result_bytes),
        selectedMarks: Number(row.selected_marks),
        selectedParts: Number(row.selected_parts),
        exceptionCode: Number(row.exception_code),
      };
    }
    delay = Math.min(delay * 2, 8_000);
  }
  return fromSummary(outcome);
}

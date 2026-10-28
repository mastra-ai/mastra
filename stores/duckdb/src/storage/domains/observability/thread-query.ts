import * as coreStorage from '@mastra/core/storage';
import type {
  ThreadQueryRow,
  TrustedThreadRowsQueryPlan,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import { DuckDBQueryTimeoutError } from '../../db';
import type { DuckDBConnection } from '../../db';
import { payloadColumnSql } from './helpers';
import { missingPreviewSql, readPreview } from './preview-compat';
import { compileThreadQueryPredicate } from './trace-query';

const contextFields = [
  'resourceId',
  'userId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'runId',
  'sessionId',
  'requestId',
  'serviceName',
  'experimentId',
  'environment',
  'executionSource',
] as const;

function predicateFields(
  predicate: TrustedTraceQueryScalarPredicate | undefined,
  fields = new Set<string>(),
): Set<string> {
  if (!predicate) return fields;
  if (predicate.type === 'boolean') for (const arg of predicate.args) predicateFields(arg, fields);
  else if (predicate.type === 'not') predicateFields(predicate.arg, fields);
  else fields.add(predicate.field);
  return fields;
}

type CandidateSize = {
  threadCount: bigint | number;
  traceCount: bigint | number;
  threadBytes: bigint | number;
  traceBytes: bigint | number;
};
// Bound identity sets, not history. Broad windows avoid large candidate joins.
export function canUseThreadCandidates(probe: CandidateSize): boolean {
  return (
    Number(probe.threadCount) <= 16_384 &&
    Number(probe.traceCount) <= 100_000 &&
    Number(probe.threadBytes) + Number(probe.traceBytes) <= 4 * 1024 * 1024
  );
}

export function compileDuckDBThreadRowsQuery(
  plan: TrustedThreadRowsQueryPlan,
  strategy: 'full' | 'candidates' | 'probe' = 'full',
) {
  const values: unknown[] = [];
  const scope: string[] = [];
  if (plan.scope) {
    values.push(plan.scope.organizationId);
    scope.push('organizationId = ?');
    if (plan.scope.resourceId !== undefined) {
      values.push(plan.scope.resourceId);
      scope.push('resourceId = ?');
    }
  }
  const identity = (field: string) => `(organizationId IS NULL, COALESCE(organizationId, ''), ${field})`;
  const threadFilter = `${identity('threadId')} IN (SELECT ${identity('threadId')} FROM candidate_threads)`;
  const endWindow = plan.timeRange.mode === 'threads' && plan.timeRange.field === 'endedAt';
  const scopedEvents = `scoped_events AS NOT MATERIALIZED (
    SELECT * FROM span_events WHERE parentSpanId IS NULL ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
  )`;
  // Seed by start/end events, then read thread IDs from all events of those
  // traces: a thread ID can arrive after the start event. Expanding complete
  // trace identities also keeps malformed sibling roots outside the seeded thread.
  const candidates = `window_traces AS MATERIALIZED (
    SELECT DISTINCT organizationId, traceId FROM scoped_events
    WHERE ${endWindow ? 'endedAt' : 'timestamp'} >= CAST(? AS TIMESTAMP) AND ${endWindow ? 'endedAt' : 'timestamp'} < CAST(? AS TIMESTAMP)
      ${endWindow ? '' : "AND eventType = 'start'"}
  ), candidate_threads AS MATERIALIZED (
    SELECT DISTINCT organizationId, threadId FROM scoped_events
    WHERE threadId IS NOT NULL AND ${identity('traceId')} IN (SELECT ${identity('traceId')} FROM window_traces)
    ${strategy === 'probe' ? 'LIMIT 16385' : ''}
  ), candidate_traces AS MATERIALIZED (
    SELECT DISTINCT organizationId, traceId FROM scoped_events WHERE ${threadFilter}
    ${strategy === 'probe' ? 'LIMIT 100001' : ''}
  )`;
  if (strategy !== 'full') values.push(plan.timeRange.from, plan.timeRange.to);
  if (strategy === 'probe') {
    return {
      sql: `WITH ${scopedEvents}, ${candidates}
      SELECT (SELECT count(*) FROM candidate_threads) AS threadCount,
        (SELECT COALESCE(sum(octet_length(encode(COALESCE(organizationId, ''))) + octet_length(encode(threadId))), 0) FROM candidate_threads) AS threadBytes,
        count(*) AS traceCount, COALESCE(sum(octet_length(encode(COALESCE(organizationId, ''))) + octet_length(encode(traceId))), 0) AS traceBytes
      FROM candidate_traces`,
      values,
    };
  }
  values.push(plan.timeRange.from, plan.timeRange.to);
  const qualify =
    plan.timeRange.mode === 'traces'
      ? 's.inWindow'
      : `s.${plan.timeRange.field} >= CAST(? AS TIMESTAMP) AND s.${plan.timeRange.field} < CAST(? AS TIMESTAMP)`;
  if (plan.timeRange.mode === 'threads') values.push(plan.timeRange.from, plan.timeRange.to);
  const predicate = plan.where ? compileThreadQueryPredicate(plan.where) : { sql: 'TRUE', values: [] };
  values.push(...predicate.values);
  let after = 'TRUE';
  if (plan.cursor) {
    const cursor = plan.cursor;
    const terms = [`s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} CAST(? AS TIMESTAMP)`];
    values.push(cursor.sortValue);
    const ids = ['organizationId', 'threadId'] as const;
    for (let i = 0; i < ids.length; i++) {
      const field = ids[i]!;
      if (cursor[field] === null) continue;
      const equal = [`s.${plan.orderBy.field} = CAST(? AS TIMESTAMP)`];
      values.push(cursor.sortValue);
      for (const prior of ids.slice(0, i)) {
        equal.push(`s.${prior} IS NOT DISTINCT FROM ?`);
        values.push(cursor[prior]);
      }
      values.push(cursor[field]);
      terms.push(`(${equal.join(' AND ')} AND (s.${field} > ? OR s.${field} IS NULL))`);
    }
    after = `(${terms.join(' OR ')})`;
  }
  values.push(plan.limit + 1);
  const filtered = predicateFields(plan.where);
  const firstContext = [...contextFields, 'timeToFirstChunkMs'].filter(
    field => field === 'resourceId' || filtered.has(field),
  );
  const contextExpression = (field: string) =>
    field === 'executionSource'
      ? 'source AS executionSource'
      : field === 'timeToFirstChunkMs'
        ? "CASE WHEN spanType = 'agent_run' THEN timeToFirstChunkMs END AS timeToFirstChunkMs"
        : field;
  const lastFields = [
    'traceId',
    'spanId',
    'cursorId',
    'resourceId',
    'endedAt',
    ...(filtered.has('status') ? ['status'] : []),
  ];
  const sql = `WITH ${scopedEvents}, ${strategy === 'candidates' ? `${candidates}, ` : ''}root_events AS (
    SELECT organizationId, threadId, traceId, spanId, cursorId, endedAt,
      ${firstContext.map(contextExpression).join(', ')},
      min(timestamp) FILTER (WHERE eventType = 'start') OVER (PARTITION BY organizationId, traceId, spanId) AS startedAt
      ${filtered.has('status') ? ", CASE WHEN error IS NULL THEN 'success' ELSE 'error' END AS status" : ''}
    FROM scoped_events ${strategy === 'candidates' ? `WHERE ${identity('traceId')} IN (SELECT ${identity('traceId')} FROM candidate_traces)` : ''}
  ), current_roots AS (
    SELECT *, row_number() OVER (PARTITION BY organizationId, traceId ORDER BY startedAt ASC, spanId, cursorId DESC) AS rootRank
    FROM root_events
  ), ranked AS (
    SELECT *, row_number() OVER first_order AS rank,
      max(endedAt) OVER population AS lastActivity, count(*) OVER population AS traceCount,
      bool_or(startedAt >= CAST(? AS TIMESTAMP) AND startedAt < CAST(? AS TIMESTAMP)) OVER population AS inWindow,
      ${lastFields.map(field => `first_value(${field}) OVER last_order AS last${field[0]!.toUpperCase()}${field.slice(1)}`).join(', ')}
    FROM current_roots WHERE rootRank = 1 AND endedAt IS NOT NULL AND startedAt IS NOT NULL AND threadId IS NOT NULL ${strategy === 'candidates' ? `AND ${threadFilter}` : ''}
    WINDOW population AS (PARTITION BY organizationId, threadId),
      first_order AS (PARTITION BY organizationId, threadId ORDER BY startedAt, traceId),
      last_order AS (PARTITION BY organizationId, threadId ORDER BY startedAt DESC, traceId DESC)
  ), rows AS (
    SELECT organizationId, threadId, traceId AS firstTraceId, spanId AS firstSpanId, cursorId AS firstCursorId,
      endedAt AS firstEndedAt, startedAt, lastActivity AS endedAt, traceCount, inWindow,
      ${firstContext.join(', ')},
      ${lastFields.map(field => `last${field[0]!.toUpperCase()}${field.slice(1)}${field === 'status' ? ' AS status' : ''}`).join(', ')}
    FROM ranked WHERE rank = 1
  ) SELECT * FROM rows s WHERE ${qualify} AND (${predicate.sql}) AND ${after}
    ORDER BY s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}, s.organizationId ASC NULLS LAST, s.threadId ASC LIMIT ?`;
  return { sql, values };
}

type Selected = Omit<ThreadQueryRow, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date;
  spanType: string;
  firstSpanId: string;
  firstCursorId: number;
  firstEndedAt: Date;
  lastSpanId: string;
  lastCursorId: number;
  lastEndedAt: Date;
  lastResourceId: string | null;
};

export async function queryThreadRows(
  db: DuckDBConnection,
  plan: TrustedThreadRowsQueryPlan,
  // Internal override for real-database conformance tests and benchmarks.
  strategy: 'auto' | 'candidates' | 'full' = 'auto',
) {
  const deadline = performance.now() + coreStorage.TRACE_QUERY_DEFAULT_TIMEOUT_MS;
  const run = async <T>(sql: string, values: unknown[]): Promise<T[]> => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new coreStorage.TraceQueryExecutionError();
    try {
      return await db.query<T>(sql, values, remaining);
    } catch (error) {
      if (error instanceof DuckDBQueryTimeoutError) throw new coreStorage.TraceQueryExecutionError();
      if (error instanceof Error && /out of memory/i.test(error.message)) {
        throw new coreStorage.TraceQueryResourceLimitError();
      }
      throw error;
    }
  };
  if (strategy === 'auto') {
    const probeQuery = compileDuckDBThreadRowsQuery(plan, 'probe');
    const [probe] = await run<CandidateSize>(probeQuery.sql, probeQuery.values);
    if (Number(probe!.threadCount) === 0) return { threads: [], page: { next: null } };
    strategy = canUseThreadCandidates(probe!) ? 'candidates' : 'full';
  }
  // Actual candidates have no LIMIT; concurrent arrivals must not truncate history.
  const compiled = compileDuckDBThreadRowsQuery(plan, strategy);
  const selected = await run<Selected>(compiled.sql, compiled.values);
  const page = selected.slice(0, plan.limit);
  if (!page.length) return { threads: [], page: { next: null } };
  const values: unknown[] = [];
  const keys = page.flatMap(row =>
    (['first', 'last'] as const).map(which => {
      const entries = {
        organizationId: row.organizationId,
        resourceId: which === 'first' ? row.resourceId : row.lastResourceId,
        traceId: row[`${which}TraceId`],
        spanId: row[`${which}SpanId`],
        cursorId: row[`${which}CursorId`],
        endedAt: row[`${which}EndedAt`],
      };
      return `(${Object.entries(entries)
        .map(([field, value]) => {
          values.push(value);
          const operator = field === 'organizationId' || field === 'resourceId' ? 'IS NOT DISTINCT FROM' : '=';
          return `${field} ${operator} ?`;
        })
        .join(' AND ')})`;
    }),
  );
  const payloads = await run<Record<string, unknown>>(
    `SELECT organizationId, traceId, cursorId,
    ${contextFields.map(field => (field === 'executionSource' ? 'source AS executionSource' : field)).join(', ')},
    CASE WHEN spanType = 'agent_run' THEN timeToFirstChunkMs END AS timeToFirstChunkMs,
    CASE WHEN error IS NULL THEN 'success' ELSE 'error' END AS status,
    ${(['input', 'output', 'error'] as const).map(field => `${field}Preview, CASE WHEN ${missingPreviewSql(`${field}Preview`)} THEN CAST(${field === 'error' ? field : payloadColumnSql(field)} AS VARCHAR) END AS ${field}`).join(', ')}
    FROM span_events WHERE ${keys.join(' OR ')}`,
    values,
  );
  const key = (org: unknown, trace: unknown, version: unknown) => JSON.stringify([org, trace, String(version)]);
  const byRoot = new Map(payloads.map(row => [key(row.organizationId, row.traceId, row.cursorId), row]));
  const threads = page.flatMap(row => {
    const first = byRoot.get(key(row.organizationId, row.firstTraceId, row.firstCursorId));
    const last = byRoot.get(key(row.organizationId, row.lastTraceId, row.lastCursorId));
    if (!first || !last) return [];
    return [
      coreStorage.threadQueryRowSchema.parse({
        organizationId: row.organizationId,
        threadId: row.threadId,
        firstTraceId: row.firstTraceId,
        lastTraceId: row.lastTraceId,
        ...Object.fromEntries(contextFields.map(field => [field, first[field]])),
        status: last.status,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt.toISOString(),
        traceCount: Number(row.traceCount),
        timeToFirstChunkMs: first.timeToFirstChunkMs,
        inputPreview: readPreview(first.inputPreview, first.input, true),
        outputPreview: readPreview(last.outputPreview, last.output, true),
        errorPreview: readPreview(last.errorPreview, last.error, true),
      }),
    ];
  });
  const last = page.at(-1)!;
  return {
    threads,
    page: {
      next:
        selected.length > plan.limit
          ? coreStorage.encodeThreadQueryCursor(plan, {
              organizationId: last.organizationId,
              threadId: last.threadId,
              sortValue: last[plan.orderBy.field].toISOString(),
            })
          : null,
    },
  };
}

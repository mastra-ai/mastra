import * as coreStorage from '@mastra/core/storage';
import type {
  ThreadQueryRow,
  TrustedThreadRowsQueryPlan,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import type { DbClient } from '../../../client';
import { qualifiedTable, TABLE_SPAN_EVENTS } from './ddl';
import { missingPreviewSql, readPreview } from './preview-compat';
import { compileThreadQueryPredicate, runWithPostgresTraceQueryTimeout } from './trace-query';

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
  threadCount: string | number;
  traceCount: string | number;
  threadBytes: string | number;
  traceBytes: string | number;
};
// Bound identity sets, not history. Broad windows avoid large candidate joins.
export function canUseThreadCandidates(probe: CandidateSize): boolean {
  return (
    Number(probe.threadCount) <= 16_384 &&
    Number(probe.traceCount) <= 100_000 &&
    Number(probe.threadBytes) + Number(probe.traceBytes) <= 4 * 1024 * 1024
  );
}

export function compilePostgresThreadRowsQuery(
  schema: string,
  plan: TrustedThreadRowsQueryPlan,
  strategy: 'full' | 'candidates' | 'probe' = 'full',
) {
  const values: unknown[] = [plan.timeRange.from, plan.timeRange.to];
  const scope: string[] = [];
  if (plan.scope) {
    values.push(plan.scope.organizationId);
    scope.push(`"organizationId" = $${values.length}`);
    if (plan.scope.resourceId !== undefined) {
      values.push(plan.scope.resourceId);
      scope.push(`"resourceId" = $${values.length}`);
    }
  }
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
  const timestamp = plan.timeRange.mode === 'threads' ? plan.timeRange.field : 'startedAt';
  const identity = (field: string) => `"organizationId" IS NULL, COALESCE("organizationId", ''), "${field}"`;
  const threadFilter = `(${identity('threadId')}) IN (SELECT ${identity('threadId')} FROM candidate_threads)`;
  const scopedRoots = `scoped_roots AS NOT MATERIALIZED (
    SELECT * FROM ${table} WHERE "parentSpanId" IS NULL ${scope.length ? `AND ${scope.join(' AND ')}` : ''}
  )`;
  // Expand complete trace identities as well as threads. A malformed sibling
  // root can have another threadId and still win canonical-root selection.
  const candidates = `candidate_threads AS MATERIALIZED (
    SELECT DISTINCT "organizationId", "threadId" FROM scoped_roots
    WHERE "threadId" IS NOT NULL AND "${timestamp}" >= $1 AND "${timestamp}" < $2
    ${strategy === 'probe' ? 'LIMIT 16385' : ''}
  ), candidate_traces AS MATERIALIZED (
    SELECT DISTINCT "organizationId", "traceId" FROM scoped_roots WHERE ${threadFilter}
    ${strategy === 'probe' ? 'LIMIT 100001' : ''}
  )`;
  if (strategy === 'probe')
    return {
      text: `WITH ${scopedRoots}, ${candidates}
      SELECT (SELECT count(*) FROM candidate_threads) AS "threadCount",
        (SELECT COALESCE(sum(octet_length(COALESCE("organizationId", '')) + octet_length("threadId")), 0) FROM candidate_threads) AS "threadBytes",
        count(*) AS "traceCount", COALESCE(sum(octet_length(COALESCE("organizationId", '')) + octet_length("traceId")), 0) AS "traceBytes"
      FROM candidate_traces`,
      values,
    };
  const predicate = plan.where
    ? compileThreadQueryPredicate(plan.where, values.length + 1)
    : { sql: 'TRUE', values: [] };
  values.push(...predicate.values);
  let after = 'TRUE';
  if (plan.cursor) {
    values.push(plan.cursor.sortValue);
    const stamp = `$${values.length}::timestamptz`;
    const field = `s."${plan.orderBy.field}"`;
    const terms = [`${field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${stamp}`];
    const equal = [`${field} = ${stamp}`];
    for (const key of ['organizationId', 'threadId'] as const) {
      const ref = `s."${key}" COLLATE "C"`;
      if (plan.cursor[key] === null) equal.push(`${ref} IS NULL`);
      else {
        values.push(plan.cursor[key]);
        const value = `$${values.length}::text COLLATE "C"`;
        terms.push(`(${equal.join(' AND ')} AND (${ref} > ${value} OR ${ref} IS NULL))`);
        equal.push(`${ref} = ${value}`);
      }
    }
    after = `(${terms.join(' OR ')})`;
  }
  const qualify =
    plan.timeRange.mode === 'traces'
      ? 's."inWindow"'
      : `s."${plan.timeRange.field}" >= $1 AND s."${plan.timeRange.field}" < $2`;
  const filtered = predicateFields(plan.where);
  const firstContext = [...contextFields, 'timeToFirstChunkMs'].filter(
    field => field === 'resourceId' || filtered.has(field),
  );
  const lastFields = [
    'traceId',
    'spanId',
    'cursorId',
    'resourceId',
    'endedAt',
    ...(filtered.has('status') ? ['status'] : []),
  ];
  values.push(plan.limit + 1);
  const text = `WITH ${scopedRoots}, ${strategy === 'candidates' ? `${candidates}, ` : ''}current_roots AS (
    SELECT DISTINCT ON ("organizationId", "traceId")
      "organizationId", "threadId", "traceId", "spanId", "cursorId", "startedAt", "endedAt", "isPending",
      ${firstContext.map(field => (field === 'timeToFirstChunkMs' ? `CASE WHEN "spanType" = 'agent_run' THEN "timeToFirstChunkMs" END AS "timeToFirstChunkMs"` : `"${field}"`)).join(', ')}
      ${filtered.has('status') ? ", CASE WHEN error IS NULL THEN 'success' ELSE 'error' END AS status" : ''}
    FROM scoped_roots ${strategy === 'candidates' ? `WHERE (${identity('traceId')}) IN (SELECT ${identity('traceId')} FROM candidate_traces)` : ''}
    ORDER BY "organizationId", "traceId", "startedAt" ASC, "spanId" COLLATE "C", "cursorId" DESC
  ), ranked AS (
    SELECT *, row_number() OVER first_order AS rank,
      max("endedAt") OVER population AS "lastActivity", count(*) OVER population AS "traceCount",
      bool_or("startedAt" >= $1 AND "startedAt" < $2) OVER population AS "inWindow",
      ${lastFields.map(field => `first_value("${field}") OVER last_order AS "last${field[0]!.toUpperCase()}${field.slice(1)}"`).join(', ')}
    FROM current_roots WHERE NOT "isPending" AND "endedAt" IS NOT NULL AND "threadId" IS NOT NULL ${strategy === 'candidates' ? `AND ${threadFilter}` : ''}
    WINDOW population AS (PARTITION BY "organizationId", "threadId"),
      first_order AS (PARTITION BY "organizationId", "threadId" ORDER BY "startedAt", "traceId" COLLATE "C"),
      last_order AS (PARTITION BY "organizationId", "threadId" ORDER BY "startedAt" DESC, "traceId" COLLATE "C" DESC)
  ), rows AS (
    SELECT "organizationId", "threadId", "traceId" AS "firstTraceId", "spanId" AS "firstSpanId", "cursorId" AS "firstCursorId",
      "endedAt" AS "firstEndedAt", "startedAt", "lastActivity" AS "endedAt", "traceCount", "inWindow",
      ${firstContext.map(field => `"${field}"`).join(', ')},
      ${lastFields.map(field => `"last${field[0]!.toUpperCase()}${field.slice(1)}"${field === 'status' ? ' AS status' : ''}`).join(', ')}
    FROM ranked WHERE rank = 1
  ) SELECT * FROM rows s WHERE ${qualify} AND (${predicate.sql}) AND ${after}
    ORDER BY s."${plan.orderBy.field}" ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'},
      s."organizationId" COLLATE "C" ASC NULLS LAST, s."threadId" COLLATE "C" ASC LIMIT $${values.length}`;
  return { text, values };
}

type Selected = Omit<ThreadQueryRow, 'startedAt' | 'endedAt'> & {
  startedAt: Date;
  endedAt: Date;
  spanType: string;
  firstSpanId: string;
  firstCursorId: string;
  firstEndedAt: Date;
  lastSpanId: string;
  lastCursorId: string;
  lastEndedAt: Date;
  lastResourceId: string | null;
};

export async function queryThreadRows(
  client: DbClient,
  schema: string,
  plan: TrustedThreadRowsQueryPlan,
  timeoutMs: number,
  // Internal override for real-database conformance tests and benchmarks.
  strategy: 'auto' | 'candidates' | 'full' = 'auto',
) {
  const deadline = performance.now() + coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  const run = async <T>(text: string, values: unknown[]): Promise<T[]> => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new coreStorage.TraceQueryExecutionError();
    return await runWithPostgresTraceQueryTimeout(client, remaining, tx => tx.any<T>(text, values));
  };
  if (strategy === 'auto') {
    const probeQuery = compilePostgresThreadRowsQuery(schema, plan, 'probe');
    const [probe] = await run<CandidateSize>(probeQuery.text, probeQuery.values);
    if (Number(probe!.threadCount) === 0) return { threads: [], page: { next: null } };
    strategy = canUseThreadCandidates(probe!) ? 'candidates' : 'full';
  }
  // Actual candidates have no LIMIT; concurrent arrivals must not truncate history.
  const compiled = compilePostgresThreadRowsQuery(schema, plan, strategy);
  const selected = await run<Selected>(compiled.text, compiled.values);
  const page = selected.slice(0, plan.limit);
  if (!page.length) return { threads: [], page: { next: null } };
  const table = qualifiedTable(schema, TABLE_SPAN_EVENTS);
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
          // Selected root keys are non-null; equality permits index scans and partition pruning.
          const operator = field === 'organizationId' || field === 'resourceId' ? 'IS NOT DISTINCT FROM' : '=';
          return `"${field}" ${operator} $${values.length}`;
        })
        .join(' AND ')})`;
    }),
  );
  const payloads = await run<Record<string, unknown>>(
    `SELECT "organizationId", "traceId", "cursorId", ${contextFields.map(field => `"${field}"`).join(', ')},
    CASE WHEN "spanType" = 'agent_run' THEN "timeToFirstChunkMs" END AS "timeToFirstChunkMs",
    CASE WHEN error IS NULL THEN 'success' ELSE 'error' END AS status,
    ${(['input', 'output', 'error'] as const).map(field => `"${field}Preview", CASE WHEN ${missingPreviewSql(`"${field}Preview"`)} THEN "${field}" END AS "${field}"`).join(', ')}
    FROM ${table} WHERE ${keys.join(' OR ')}`,
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
        inputPreview: readPreview(first.inputPreview, first.input),
        outputPreview: readPreview(last.outputPreview, last.output),
        errorPreview: readPreview(last.errorPreview, last.error),
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

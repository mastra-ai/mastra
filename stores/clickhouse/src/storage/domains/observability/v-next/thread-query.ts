import { TupleParam } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import * as coreStorage from '@mastra/core/storage';
import type {
  ThreadQueryRow,
  TrustedThreadRowsQueryPlan,
  TrustedTraceQueryScalarPredicate,
} from '@mastra/core/storage';
import { TABLE_TRACE_ROOTS } from './ddl';
import { needsPreviewPayloads, PREVIEW_COLUMNS, resolveStoredPreviews } from './previews';
import {
  compileThreadQueryPredicate,
  ParameterBuilder,
  ROOT_VERSION_ORDER,
  runWithClickHouseTraceQueryTimeout,
} from './trace-query';

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

function afterCursor(plan: TrustedThreadRowsQueryPlan, parameters: ParameterBuilder): string {
  if (!plan.cursor) return '1';
  const { cursor } = plan;
  const stamp = parameters.add(cursor.sortValue, "DateTime64(3, 'UTC')");
  const field = `s.${plan.orderBy.field}`;
  const terms = [`${field} ${plan.orderBy.direction === 'asc' ? '>' : '<'} ${stamp}`];
  const equal = [`${field} = ${stamp}`];
  for (const key of ['organizationId', 'threadId'] as const) {
    if (cursor[key] === null) equal.push(`isNull(s.${key})`);
    else {
      const value = parameters.add(cursor[key], 'String');
      terms.push(`(${equal.join(' AND ')} AND (s.${key} > ${value} OR isNull(s.${key})))`);
      equal.push(`s.${key} = ${value}`);
    }
  }
  return `(${terms.join(' OR ')})`;
}

// Keep the root sort and thread aggregation within a bounded memory budget.
// Broad-history execution also has an admission limit below: spill alone does not
// bound the per-trace selection state or the final aggregation merge.
export const THREAD_QUERY_EXECUTION_LIMITS = {
  memoryLimitBytes: 512 * 1024 * 1024,
  maxThreads: 2,
  maxBlockSize: 4096,
  spillThresholdBytes: 32 * 1024 * 1024,
} as const;

// Probe bounded identity sets before choosing the candidate plan. Broad windows and
// very large threads use the streaming/spilling full-history plan instead.
const MAX_CANDIDATE_THREADS = 16_384;
const MAX_CANDIDATE_TRACES = 100_000;
const MAX_CANDIDATE_ID_BYTES = 4 * 1024 * 1024;
// Fragmented 90-day fixtures can exceed 512 MiB at 500K retained roots when
// merging spilled aggregates. Count physical copies conservatively, with headroom.
// Narrow candidate queries remain available above this full-history budget.
const MAX_FULL_HISTORY_ROOTS = 250_000;
type CandidateSize = {
  threadCount: string | number;
  traceCount: string | number;
  threadBytes: string | number;
  traceBytes: string | number;
};
export function canUseThreadCandidates(probe: CandidateSize): boolean {
  return (
    Number(probe.threadCount) <= MAX_CANDIDATE_THREADS &&
    Number(probe.traceCount) <= MAX_CANDIDATE_TRACES &&
    Number(probe.threadBytes) + Number(probe.traceBytes) <= MAX_CANDIDATE_ID_BYTES
  );
}
const identity = (field: 'threadId' | 'traceId') =>
  `tuple(isNull(organizationId), ifNull(organizationId, ''), ${field})`;
const candidateThreadsFilter = `${identity('threadId')} IN (SELECT ${identity('threadId')} FROM candidate_threads)`;
const candidateTracesFilter = `${identity('traceId')} IN (SELECT ${identity('traceId')} FROM candidate_traces)`;

function candidateCtes(scope: string[], from: string, to: string, plan: TrustedThreadRowsQueryPlan, probe = false) {
  const timestamp = plan.timeRange.mode === 'threads' ? plan.timeRange.field : 'startedAt';
  const scoped = scope.length ? `${scope.join(' AND ')} AND ` : '';
  return `candidate_threads AS (
    SELECT DISTINCT organizationId, threadId FROM ${TABLE_TRACE_ROOTS}
    WHERE ${scoped}threadId IS NOT NULL AND ${timestamp} >= ${from} AND ${timestamp} < ${to}
    ${probe ? `LIMIT ${MAX_CANDIDATE_THREADS + 1}` : ''}
  ), candidate_traces AS (
    SELECT DISTINCT organizationId, traceId FROM ${TABLE_TRACE_ROOTS}
    WHERE ${scoped}${candidateThreadsFilter}
    ${probe ? `LIMIT ${MAX_CANDIDATE_TRACES + 1}` : ''}
  )`;
}

export function compileClickHouseThreadRowsQuery(
  plan: TrustedThreadRowsQueryPlan,
  strategy: 'full' | 'candidates' | 'probe' | 'historyBudget' = 'full',
) {
  const parameters = new ParameterBuilder();
  const from = parameters.add(plan.timeRange.from, "DateTime64(3, 'UTC')");
  const to = parameters.add(plan.timeRange.to, "DateTime64(3, 'UTC')");
  const scope: string[] = [];
  if (plan.scope) {
    scope.push(`organizationId = ${parameters.add(plan.scope.organizationId, 'String')}`);
    if (plan.scope.resourceId !== undefined)
      scope.push(`resourceId = ${parameters.add(plan.scope.resourceId, 'String')}`);
  }
  if (strategy === 'historyBudget') {
    return {
      query: `SELECT count() AS rootCount FROM (
        SELECT 1 FROM ${TABLE_TRACE_ROOTS} ${scope.length ? `WHERE ${scope.join(' AND ')}` : ''}
        LIMIT ${MAX_FULL_HISTORY_ROOTS + 1}
      )`,
      query_params: parameters.params,
    };
  }
  if (strategy === 'probe') {
    return {
      query: `WITH ${candidateCtes(scope, from, to, plan, true)}
        SELECT (SELECT count() FROM candidate_threads) AS threadCount,
          (SELECT sum(length(ifNull(organizationId, '')) + length(threadId)) FROM candidate_threads) AS threadBytes,
          count() AS traceCount, sum(length(ifNull(organizationId, '')) + length(traceId)) AS traceBytes
        FROM candidate_traces`,
      query_params: parameters.params,
    };
  }
  const predicate = plan.where ? compileThreadQueryPredicate(plan.where, parameters).sql : '1';
  const after = afterCursor(plan, parameters);
  const qualify =
    plan.timeRange.mode === 'traces'
      ? 's.inWindow > 0'
      : `s.${plan.timeRange.field} >= ${from} AND s.${plan.timeRange.field} < ${to}`;
  const filtered = predicateFields(plan.where);
  const firstContext = [...contextFields, 'timeToFirstChunkMs'].filter(
    field => field === 'resourceId' || filtered.has(field),
  );
  const firstFields = ['startedAt', 'traceId', 'spanId', 'endedAt', ...firstContext];
  const lastFields = [
    'startedAt',
    'traceId',
    'spanId',
    'endedAt',
    'resourceId',
    ...(filtered.has('status') ? ['status'] : []),
  ];
  // Select one root per logical trace before applying thread identity or time filters.
  // Malformed extra roots can disagree on thread/time; they must not qualify a thread.
  // Use the earliest-started root, then the lowest spanId, consistently across stores.
  // Within that root, keep the current version (ROOT_VERSION_ORDER), as every root collapse does.
  const rootDataFields = [
    'threadId',
    'spanId',
    'startedAt',
    'endedAt',
    ...firstContext,
    ...(filtered.has('status') ? ['status'] : []),
  ];
  const rootExpression = (field: string) =>
    field === 'timeToFirstChunkMs'
      ? "if(spanType = 'agent_run', timeToFirstChunkMs, NULL)"
      : field === 'status'
        ? "if(isNull(error), 'success', 'error')"
        : field;
  const sortedRoots = `roots AS (
    SELECT organizationId, traceId, ${rootDataFields.map(field => `${rootExpression(field)} AS ${field}`).join(', ')}
    FROM ${TABLE_TRACE_ROOTS} ${scope.length || strategy === 'candidates' ? `WHERE ${[...scope, ...(strategy === 'candidates' ? [candidateTracesFilter] : [])].join(' AND ')}` : ''}
    ORDER BY organizationId, traceId, startedAt ASC, spanId, ${ROOT_VERSION_ORDER}
    LIMIT 1 BY organizationId, traceId
  )`;
  const query = `WITH ${strategy === 'candidates' ? `${candidateCtes(scope, from, to, plan)}, ` : ''}${sortedRoots}, grouped AS (
    SELECT organizationId, threadId, min(startedAt) AS firstActivity, max(endedAt) AS lastActivity,
      count() AS traceCount, countIf(startedAt >= ${from} AND startedAt < ${to}) AS inWindow,
      min(tuple(${firstFields.join(', ')})) AS first,
      max(tuple(${lastFields.join(', ')})) AS last
    FROM roots WHERE threadId IS NOT NULL ${strategy === 'candidates' ? `AND ${candidateThreadsFilter}` : ''} GROUP BY organizationId, threadId
  ), rows AS (
    SELECT organizationId, threadId, firstActivity AS startedAt, lastActivity AS endedAt, traceCount, inWindow,
      ${firstFields.map((field, i) => `first.${i + 1} AS ${i < 4 ? `first${field[0]!.toUpperCase()}${field.slice(1)}` : field}`).join(', ')},
      ${lastFields.map((field, i) => `last.${i + 1} AS ${field === 'status' ? 'status' : `last${field[0]!.toUpperCase()}${field.slice(1)}`}`).join(', ')}
    FROM grouped
  ) SELECT * FROM rows s WHERE ${qualify} AND (${predicate}) AND ${after}
  ORDER BY s.${plan.orderBy.field} ${plan.orderBy.direction === 'asc' ? 'ASC' : 'DESC'}, s.organizationId ASC NULLS LAST, s.threadId ASC
  LIMIT ${parameters.add(plan.limit + 1, 'UInt64')}`;
  return { query, query_params: parameters.params };
}

type Selected = ThreadQueryRow & {
  firstSpanId: string;
  firstStartedAt: string;
  firstEndedAt: string;
  lastSpanId: string;
  lastStartedAt: string;
  lastEndedAt: string;
  lastResourceId: string | null;
};
type Root = {
  organizationId: string | null;
  resourceId: string | null;
  traceId: string;
  spanId: string;
  startedAt: string;
  endedAt: string;
};
const rootKey = (row: Root) => JSON.stringify([row.organizationId, row.traceId, row.spanId]);
const iso = (value: string) => new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toISOString();

/** Bound HTTP form parameter size as well as payload rows. Long IDs must not break large pages. */
function* batches<T extends Root>(rows: T[], maxRows = 256): Generator<T[]> {
  let batch: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = Buffer.byteLength(JSON.stringify(row), 'utf8') * 2;
    if (batch.length && (batch.length >= maxRows || bytes + size > 48 * 1024)) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(row);
    bytes += size;
  }
  if (batch.length) yield batch;
}

export async function queryThreadRows(
  client: ClickHouseClient,
  plan: TrustedThreadRowsQueryPlan,
  timeoutMs: number,
  // Internal override for real-database conformance tests and benchmarks.
  strategy: 'auto' | 'candidates' | 'full' = 'auto',
) {
  const deadline = performance.now() + coreStorage.resolveTraceQueryTimeoutMs(timeoutMs);
  const run = async <T>(compiled: { query: string; query_params: Record<string, unknown> }): Promise<T[]> => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new coreStorage.TraceQueryExecutionError();
    return (await runWithClickHouseTraceQueryTimeout(
      client,
      { timeoutMs: remaining, ...THREAD_QUERY_EXECUTION_LIMITS },
      compiled,
    )) as T[];
  };
  if (strategy === 'auto') {
    const [probe] = await run<CandidateSize>(compileClickHouseThreadRowsQuery(plan, 'probe'));
    if (Number(probe!.threadCount) === 0) return { threads: [], page: { next: null } };
    strategy = canUseThreadCandidates(probe!) ? 'candidates' : 'full';
  }
  if (strategy === 'full') {
    const [budget] = await run<{ rootCount: number | string }>(compileClickHouseThreadRowsQuery(plan, 'historyBudget'));
    if (Number(budget!.rootCount) > MAX_FULL_HISTORY_ROOTS) throw new coreStorage.TraceQueryResourceLimitError();
  }
  // Candidate sets are recomputed without LIMIT in the selection statement. A
  // concurrent insert must never turn a planning budget into truncated history.
  // Likewise, the history admission check never truncates the selection. The
  // execution memory/deadline limits still apply if data grows after the check.
  const selected = await run<Selected>(compileClickHouseThreadRowsQuery(plan, strategy));
  const page = selected.slice(0, plan.limit);
  if (!page.length) return { threads: [], page: { next: null } };
  const roots = new Map<string, Root>();
  const representative = (row: Selected, which: 'first' | 'last'): Root => ({
    organizationId: row.organizationId,
    resourceId: which === 'first' ? row.resourceId : row.lastResourceId,
    traceId: row[`${which}TraceId`],
    spanId: row[`${which}SpanId`],
    startedAt: row[`${which}StartedAt`],
    endedAt: row[`${which}EndedAt`],
  });
  for (const row of page)
    for (const which of ['first', 'last'] as const) {
      const root = representative(row, which);
      roots.set(rootKey(root), root);
    }
  const keys = (batch: Root[]) =>
    batch.map(
      root =>
        new TupleParam([
          root.organizationId === null ? 1 : 0,
          root.organizationId ?? '',
          root.resourceId === null ? 1 : 0,
          root.resourceId ?? '',
          root.traceId,
          root.spanId,
          iso(root.startedAt).replace('T', ' ').replace(/Z$/, ''),
          iso(root.endedAt).replace('T', ' ').replace(/Z$/, ''),
        ]),
    );
  const rootWhere = `tuple(isNull(organizationId), ifNull(organizationId, ''), isNull(resourceId), ifNull(resourceId, ''),
    traceId, spanId, startedAt, endedAt) IN {roots:Array(Tuple(UInt8, String, UInt8, String, String, String, DateTime64(3, 'UTC'), DateTime64(3, 'UTC')))}`;
  const stored: Array<Root & Record<string, unknown>> = [];
  for (const batch of batches([...roots.values()]))
    stored.push(
      ...(await run<Root & Record<string, unknown>>({
        query: `SELECT organizationId, traceId, spanId, startedAt, endedAt,
      ${contextFields.join(', ')}, if(spanType = 'agent_run', timeToFirstChunkMs, NULL) AS timeToFirstChunkMs,
      if(isNull(error), 'success', 'error') AS status, ${PREVIEW_COLUMNS.join(', ')}
      FROM ${TABLE_TRACE_ROOTS} WHERE ${rootWhere}
      ORDER BY ${ROOT_VERSION_ORDER} LIMIT 1 BY organizationId, traceId, spanId`,
        query_params: { roots: keys(batch) },
      })),
    );
  const byRoot = new Map(stored.map(row => [rootKey(row), row]));
  const missing = stored.filter(needsPreviewPayloads);
  // Bound legacy payload memory independently of the page size, as in querySpans.
  for (const batch of batches(missing, 32)) {
    const payloads = await run<Root & Record<string, unknown>>({
      query: `SELECT organizationId, traceId, spanId, input, output, error FROM ${TABLE_TRACE_ROOTS}
        WHERE ${rootWhere} ORDER BY ${ROOT_VERSION_ORDER} LIMIT 1 BY organizationId, traceId, spanId`,
      query_params: { roots: keys(batch) },
    });
    for (const payload of payloads) {
      const row = byRoot.get(rootKey(payload));
      if (row) Object.assign(row, resolveStoredPreviews(row, payload));
    }
  }
  const threads = page.flatMap(row => {
    const first = byRoot.get(rootKey(representative(row, 'first')));
    const last = byRoot.get(rootKey(representative(row, 'last')));
    if (!first || !last) return []; // Concurrent deletion between selection and hydration.
    return [
      coreStorage.threadQueryRowSchema.parse({
        organizationId: row.organizationId,
        threadId: row.threadId,
        firstTraceId: row.firstTraceId,
        lastTraceId: row.lastTraceId,
        ...Object.fromEntries(contextFields.map(field => [field, first[field]])),
        status: last.status,
        startedAt: iso(row.startedAt),
        endedAt: iso(row.endedAt),
        traceCount: Number(row.traceCount),
        timeToFirstChunkMs: first.timeToFirstChunkMs,
        inputPreview: resolveStoredPreviews(first).inputPreview,
        outputPreview: resolveStoredPreviews(last).outputPreview,
        errorPreview: resolveStoredPreviews(last).errorPreview,
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
              sortValue: iso(last[plan.orderBy.field]),
            })
          : null,
    },
  };
}

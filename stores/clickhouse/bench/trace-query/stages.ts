/**
 * Stage plumbing for the trace-query suite:
 * - key-only reads (ids and timestamps only; kept in memory, never persisted or logged) used to
 *   build page-mode payload keys and real deep cursors;
 * - querySpans() hydration SQL, obtained by running the store's own querySpans() against a capture
 *   client that never touches the network, so the harness measures exactly what the store issues.
 */
import type { ClickHouseClient } from '@clickhouse/client';
import type { TrustedSpanQueryPlan } from '@mastra/core/storage';

import { querySpans } from '../../src/storage/domains/observability/v-next/span-query';
import { compileClickHouseTraceRootPayloads } from '../../src/storage/domains/observability/v-next/trace-query';
import type { QueryOutcome } from '../shared/client';
import { registerSensitive } from '../shared/env';
import type { ProjectScope } from '../shared/profile';
import { scopePayloadQuery, scopeSpanHydration } from '../shared/scope';
import type { CursorAt } from './cases';

export interface Statement {
  query: string;
  query_params: Record<string, unknown>;
  sharedSnapshot?: boolean;
}

/** Runs one key-only statement and returns parsed rows; the caller supplies pacing (the pool). */
export type KeyRunner = <Row>(statement: Statement, step: string) => Promise<QueryOutcome<Row>>;

export class KeyQueryFailed extends Error {
  constructor(step: string, outcome: QueryOutcome<unknown>) {
    super(`Key query ${step} failed (code ${outcome.errorCode ?? '?'}, ${outcome.errorCategory ?? 'other'})`);
    this.name = 'KeyQueryFailed';
  }
}

async function keyRows<Row>(run: KeyRunner, statement: Statement, step: string): Promise<Row[]> {
  const outcome = await run<Row>(statement, step);
  if (!outcome.ok) throw new KeyQueryFailed(step, outcome);
  return outcome.rows!;
}

const iso = (value: string) => new Date(value).toISOString();

/** Wraps a compiled statement so only the named key columns leave the server. */
export function keyOnly(statement: Statement, columns: string, where = ''): Statement {
  return { ...statement, query: `SELECT ${columns} FROM (${statement.query})${where ? ` WHERE ${where}` : ''}` };
}

// ---------------------------------------------------------------------------
// queryTraces() page mode: payload keys and payload statements
// ---------------------------------------------------------------------------

export interface PageKey {
  traceId: string;
  rootSpanId: string;
  startedAt: string;
  endedAt: string;
}

export async function pageKeys(run: KeyRunner, list: Statement): Promise<PageKey[]> {
  const rows = await keyRows<PageKey>(
    run,
    keyOnly(
      list,
      'toString(traceId) AS traceId, toString(rootSpanId) AS rootSpanId, startedAt, endedAt',
      '__metadata = 0',
    ),
    'page-keys',
  );
  const keys = rows.map(row => ({ ...row, startedAt: iso(row.startedAt), endedAt: iso(row.endedAt) }));
  registerSensitive(keys.flatMap(k => [k.traceId, k.rootSpanId]));
  return keys;
}

export function payloadStatement(keys: PageKey[], scope: ProjectScope, scoped: boolean): Statement {
  const compiled = compileClickHouseTraceRootPayloads(keys);
  return scoped ? scopePayloadQuery(compiled, scope.organizationId, scope.projectId) : compiled;
}

// ---------------------------------------------------------------------------
// Deep cursors: walk the real result order in pages of `hop` rows
// ---------------------------------------------------------------------------

/**
 * Walks `depth` rows deep in hops of `hop` rows. `fetchHop(cursor)` must return the key rows of
 * one page compiled with limit `hop` (the compiler returns up to hop+1). Returns undefined when the
 * result has fewer than `depth` rows, so the case is recorded as skipped rather than run shallow.
 */
export async function walkCursor(
  depth: number,
  hop: number,
  fetchHop: (cursor: CursorAt | undefined) => Promise<CursorAt[]>,
): Promise<CursorAt | undefined> {
  if (depth % hop !== 0) throw new Error(`depth ${depth} must be a multiple of ${hop}`);
  let cursor: CursorAt | undefined;
  for (let walked = 0; walked < depth; walked += hop) {
    const rows = await fetchHop(cursor);
    if (rows.length < hop) return undefined;
    cursor = rows[hop - 1];
  }
  return cursor;
}

export async function traceCursorRows(
  run: KeyRunner,
  list: Statement,
  orderField: 'startedAt' | 'endedAt',
): Promise<CursorAt[]> {
  const rows = await keyRows<{ traceId: string; sortValue: string }>(
    run,
    keyOnly(list, `toString(traceId) AS traceId, ${orderField} AS sortValue`),
    'trace-cursor',
  );
  registerSensitive(rows.map(r => r.traceId));
  return rows.map(r => ({ kind: 'traces', traceId: r.traceId, sortValue: iso(r.sortValue) }));
}

export async function threadCursorRows(run: KeyRunner, list: Statement): Promise<CursorAt[]> {
  const rows = await keyRows<{ threadId: string }>(
    run,
    keyOnly(list, 'toString(threadId) AS threadId'),
    'thread-cursor',
  );
  registerSensitive(rows.map(r => r.threadId));
  return rows.map(r => ({ kind: 'threads', threadId: r.threadId }));
}

export interface SpanSelectRow {
  organizationId: string | null;
  resourceId: string | null;
  traceId: string;
  spanId: string;
  startedAt: string;
  endedAt: string;
}

/** The querySpans() select stage already returns only identities and timestamps. */
export async function spanSelectRows(run: KeyRunner, select: Statement): Promise<SpanSelectRow[]> {
  const rows = await keyRows<SpanSelectRow>(run, select, 'span-select');
  registerSensitive(
    rows.flatMap(r => [r.organizationId ?? '', r.resourceId ?? '', r.traceId, r.spanId].filter(Boolean)),
  );
  return rows;
}

export function spanCursor(row: SpanSelectRow, orderField: 'startedAt' | 'endedAt'): CursorAt {
  return {
    kind: 'spans',
    organizationId: row.organizationId,
    resourceId: row.resourceId,
    traceId: row.traceId,
    spanId: row.spanId,
    sortValue: iso(row[orderField]),
  };
}

// ---------------------------------------------------------------------------
// Delta
// ---------------------------------------------------------------------------

export interface Watermark {
  cursorId: string;
  traceId: string;
}

export async function deltaHead(run: KeyRunner, head: Statement): Promise<Watermark> {
  const rows = await keyRows<Watermark>(run, head, 'delta-head');
  const row = rows[0] ?? { cursorId: '0', traceId: '' };
  registerSensitive([row.traceId].filter(Boolean));
  return row;
}

/** A watermark `back` delta rows behind the head (global: the delta index has no tenant columns). */
export async function recentWatermark(run: KeyRunner, back: number): Promise<Watermark | undefined> {
  const rows = await keyRows<Watermark>(
    run,
    {
      query:
        'SELECT toString(cursorId) AS cursorId, traceId FROM mastra_trace_roots_delta ORDER BY cursorId DESC, traceId DESC LIMIT 1 OFFSET {back:UInt64}',
      query_params: { back },
    },
    'delta-watermark',
  );
  if (rows[0]) registerSensitive([rows[0].traceId]);
  return rows[0];
}

// ---------------------------------------------------------------------------
// querySpans() hydration via a capture client
// ---------------------------------------------------------------------------

export interface SpanHydration {
  payload: Statement;
  metrics: Statement;
}

/**
 * Runs the store's real querySpans() with a client that answers the select stage with `selected`
 * and records (without executing) every later statement. Returns undefined for an empty page
 * (querySpans() issues no hydration then).
 */
export async function captureSpanHydration(
  plan: TrustedSpanQueryPlan,
  selected: SpanSelectRow[],
): Promise<SpanHydration | undefined> {
  const captured: Statement[] = [];
  let calls = 0;
  const capture = {
    query: async (args: { query: string; query_params?: Record<string, unknown> }) => {
      calls++;
      if (calls > 1) captured.push({ query: args.query, query_params: args.query_params ?? {} });
      return { json: async () => (calls === 1 ? selected : []) };
    },
  } as unknown as ClickHouseClient;
  await querySpans(capture, plan, 300_000);
  if (captured.length === 0) return undefined;
  if (captured.length !== 2) throw new Error(`querySpans() issued ${captured.length} hydration statements, expected 2`);
  const [payload, metrics] = captured as [Statement, Statement];
  if (!payload.query.includes('FROM mastra_span_events') || !metrics.query.includes('FROM mastra_metric_events')) {
    throw new Error('querySpans() hydration statements changed shape');
  }
  return { payload, metrics };
}

export function scopedSpanHydration(h: SpanHydration, scope: ProjectScope, from: string): SpanHydration {
  return {
    payload: scopeSpanHydration(h.payload, 'payload', { ...scope, from }),
    metrics: scopeSpanHydration(h.metrics, 'metrics', scope),
  };
}

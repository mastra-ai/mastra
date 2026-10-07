/**
 * Stage plumbing for the trace-query suite:
 * - queryTraces() statements, obtained by running the store's own queryTraces() against a capture
 *   client that answers with key-only reads, so the harness measures exactly what the store issues;
 * - key-only reads (ids and timestamps only; kept in memory, never persisted or logged) used for
 *   real deep cursors;
 * - querySpans() hydration SQL, obtained by running the store's own querySpans() against a capture
 *   client that never touches the network, so the harness measures exactly what the store issues.
 */
import type { ClickHouseClient, ClickHouseSettings } from '@clickhouse/client';
import { coreFeatures } from '@mastra/core/features';
import type { TrustedSpanQueryPlan, TrustedTraceQueryPlan } from '@mastra/core/storage';

import { querySpans } from '../../src/storage/domains/observability/v-next/span-query';
import type { queryTraces } from '../../src/storage/domains/observability/v-next/trace-query';
import type { QueryOutcome } from '../shared/client';
import { registerSensitive } from '../shared/env';
import type { ProjectScope } from '../shared/profile';
import { injectPayloadProjectScope, injectProjectScope, scopePayloadQuery, scopeSpanHydration } from '../shared/scope';
import type { Relation } from '../shared/scope';
import type { CursorAt } from './cases';

export interface Statement {
  query: string;
  query_params: Record<string, unknown>;
  sharedSnapshot?: boolean;
  /** Settings the store adds to this statement (never execution limits: the bench tier sets those). */
  settings?: ClickHouseSettings;
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
// queryTraces() statements via a capture client
// ---------------------------------------------------------------------------

/**
 * - `main`: the first statement: total-and-bound (keyset / page), the delta list, or the groups list.
 * - `list`: the bounded list (keyset / page).
 * - `payload`: `metadata` / `input` for the returned rows.
 */
export interface TraceStatements {
  main: Statement;
  list?: Statement;
  payload?: Statement;
  /** A key read that failed (e.g. a statement over its memory limit); later statements were not issued. */
  keyFailure?: string;
}

export type QueryTracesFn = typeof queryTraces;

/** Store settings that are execution limits or snapshot flags; the bench tier and `sharedSnapshot` own those. */
const OWNED_SETTINGS = new Set(['max_execution_time', 'max_memory_usage', 'enable_shared_storage_snapshot_in_query']);

/** Bookkeeping columns some compilers return alongside the rows; kept so the flow sees the same shape. */
const FLOW_COLUMNS = ['total', '__metadata', '__delta_cursor'];

/**
 * Runs a real queryTraces() (the current compiler, or a legacy copy for comparison) with a client that
 * project-scopes every statement it issues, fail-closed, and records it. Answers come from key-only
 * reads through `run`: the total-and-bound statement as is (counts and a timestamp), list rows reduced
 * to ids and timestamps, and no payloads. Groups and payload statements are recorded, not executed.
 * A failed key read answers with no rows, so the statements issued so far are still returned.
 */
export async function captureTraceQuery(
  impl: QueryTracesFn,
  plan: TrustedTraceQueryPlan,
  scope: ProjectScope,
  relations: readonly Relation[],
  run: KeyRunner,
  head?: Watermark,
): Promise<TraceStatements> {
  const captured: Array<{ kind: 'bound' | 'list' | 'payload'; statement: Statement }> = [];
  let keyFailure: string | undefined;
  const read = async <Row>(statement: Statement, step: string): Promise<Row[]> => {
    if (keyFailure) return [];
    try {
      return await keyRows<Row>(run, statement, step);
    } catch (error) {
      if (!(error instanceof KeyQueryFailed)) throw error;
      keyFailure = error.message;
      return [];
    }
  };
  const capture = {
    query: async (args: {
      query: string;
      query_params?: Record<string, unknown>;
      clickhouse_settings?: ClickHouseSettings;
    }) => {
      const answer = (rows: unknown[]) => ({ json: async () => rows });
      if (args.query.includes('_delta ORDER BY cursorId DESC')) {
        if (!head) throw new Error('queryTraces() asked for the delta head, but none was given');
        return answer([head]);
      }
      const all = args.clickhouse_settings ?? {};
      const settings = Object.fromEntries(Object.entries(all).filter(([key]) => !OWNED_SETTINGS.has(key)));
      const raw: Statement = {
        query: args.query,
        query_params: args.query_params ?? {},
        sharedSnapshot: all.enable_shared_storage_snapshot_in_query === 1,
        settings,
      };
      if (args.query.startsWith('SELECT traceId, spanId AS rootSpanId, metadataRaw AS metadata')) {
        const statement = /AND organizationId = \{trace_query_\d+:String\}/.test(raw.query)
          ? injectPayloadProjectScope(raw, scope.projectId)
          : { ...raw, ...scopePayloadQuery(raw, scope.organizationId, scope.projectId) };
        captured.push({ kind: 'payload', statement });
        return answer([]);
      }
      const statement = injectProjectScope(raw, scope.projectId, relations);
      if (args.query.includes(' AS bound')) {
        captured.push({ kind: 'bound', statement });
        return answer(await read(statement, 'trace-bound'));
      }
      captured.push({ kind: 'list', statement });
      if (plan.result === 'groups') return answer([]);
      const extra = FLOW_COLUMNS.filter(column => new RegExp(`\\b${column}\\b`).test(statement.query));
      const columns = [
        'toString(traceId) AS traceId',
        'toString(rootSpanId) AS rootSpanId',
        'startedAt',
        'endedAt',
        ...extra,
      ];
      const rows = await read<Record<string, unknown>>(keyOnly(statement, columns.join(', ')), 'trace-keys');
      registerSensitive(
        rows.flatMap(row => [row.traceId, row.rootSpanId].filter(v => typeof v === 'string')) as string[],
      );
      // The response schema needs these; the bench discards the response.
      return answer(rows.map(row => ({ ...row, name: '', status: 'success' })));
    },
  } as unknown as ClickHouseClient;
  // Delta mode needs the polling feature and a cursor strategy; other modes run without them so
  // numbered pages don't add the delta-head bootstrap.
  const delta = plan.paginationMode === 'delta';
  if (delta) coreFeatures.add('observability-delta-polling');
  try {
    await impl(capture, plan, 300_000, delta ? 'serial' : null);
  } finally {
    if (delta) coreFeatures.delete('observability-delta-polling');
  }

  const kinds = captured.map(c => c.kind).join(',');
  const shapes: Record<string, string[]> = {
    keyset: ['bound', 'bound,list', 'bound,list,payload', 'list'],
    page: ['bound', 'bound,list', 'bound,list,payload', 'list', 'list,payload'],
    delta: ['list', 'list,payload'],
    groups: ['list'],
  };
  const mode = plan.result === 'groups' ? 'groups' : plan.paginationMode;
  if (!shapes[mode]!.includes(kinds)) throw new Error(`queryTraces() ${mode} issued [${kinds}]`);
  const [first, ...rest] = captured;
  return {
    main: first!.statement,
    list: rest.find(c => c.kind === 'list')?.statement,
    payload: captured.find(c => c.kind === 'payload')?.statement,
    ...(keyFailure ? { keyFailure } : {}),
  };
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

/**
 * Platform mobs-query trace-query experiments (OBS-610, QX25+). Runs Platform's own planners and query functions
 * (`queryTraces`, `queryThreads`, `querySpans`, `queryFields`, `queryValues`) from one or two Platform checkouts against
 * the read-only prod replica, through a guarded client adapter. Nothing from Platform is copied here: modules are
 * imported by path from `--old` / `--new`.
 *
 *   tsx bench/trace-query/platform.ts ship  --exp QX25 --old /tmp/platform-610-base [--new /tmp/platform-610]
 *                                           --cases T0,P0 --targets p99,largest --windows 1d,7d [--reps 3] [--cold]
 *   tsx bench/trace-query/platform.ts equiv --exp QX26 --old <checkout> --new <checkout> --cases ... --targets ...
 *   tsx bench/trace-query/platform.ts summary --exp QX25
 *
 * Safety: same model as experiments.ts — host guard, read-only allowlist and Tier 1 limits on every statement (the
 * BenchClient), one statement at a time with a 3 s pace, a per-session statement budget, and a fail-closed check that
 * every Platform table scan carries this project's org/project fence. Results only pass through memory; records hold
 * bucket + project hash, metrics, and SHA-256 hashes / counts of responses. Metrics come from each statement's
 * X-ClickHouse-Summary (peak memory, bytes/rows read, server elapsed), as in every earlier QX experiment: the
 * replica's query_log isn't readable (preflight `queryLog: none`).
 *
 * Platform caps each statement at 512 MiB (discovery 256 MiB) and the request at 9 s. The adapter lifts those to the
 * Tier 1 limits so "before" numbers show the real cost, and records whether each statement would have failed at
 * Platform's own cap, at #3511's 1 GiB and at 9 s. The 9 s request deadline is suspended for the bench process
 * (`performance.now` is advanced past the time spent in our own statements and pauses) so later statements of a
 * slow request still run and are measured.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { TupleParam } from '@clickhouse/client';

import { TIERS } from '../shared/client';
import type { BenchClient, QueryOutcome } from '../shared/client';
import { installOutputRedaction, loadCredentials } from '../shared/env';
import { fromSummary } from '../shared/metrics';
import type { QueryMetrics } from '../shared/metrics';
import { loadSelection } from '../shared/profile';
import type { SelectedProject } from '../shared/profile';
import { median } from '../shared/report-kit';
import { connect, log, readJson, readRecords } from '../shared/runner';
import type { Preflight } from '../shared/runner';
import { caseById, timeRangeFor, WINDOWS } from './cases';
import { literalsFor, loadSidecar } from './discover';
import type { Sidecar } from './discover';
import { resolveTargets } from './experiments';
import { files, RESULTS_DIR } from './run';

export const PLATFORM_FILE = `${RESULTS_DIR}/platform.jsonl`;
const OVERLOAD_PAUSE_MS = 60_000;
const MiB = 2 ** 20;
const tier = TIERS[1];

type Json = Record<string, unknown>;
type Scope = { organizationId: string; projectId: string };

// ---------------------------------------------------------------------------
// Platform checkouts
// ---------------------------------------------------------------------------

interface PlatformArm {
  name: 'old' | 'new';
  plan: {
    planPlatformTraceQuery(input: unknown, scope: Scope): Json;
    planPlatformThreadQuery(input: unknown, scope: Scope): Json;
    planPlatformSpanQuery(input: unknown, scope: Scope): Json;
    planPlatformTraceQueryFields(input: unknown, scope: Scope): Json;
    planPlatformTraceQueryValues(input: unknown, scope: Scope): Json;
    encodePlatformTraceQueryDeltaCursor(plan: Json, watermark: string): string;
  };
  traces: {
    queryTraces(client: unknown, plan: Json): Promise<Json>;
    queryThreads(client: unknown, plan: Json): Promise<Json>;
    queryFields(client: unknown, plan: Json): Promise<Json>;
    queryValues(client: unknown, plan: Json): Promise<Json>;
  };
  spans: { querySpans(client: unknown, plan: Json): Promise<Json> };
}

async function loadArm(name: PlatformArm['name'], root: string): Promise<PlatformArm> {
  const dir = `${root}/servers/mobs-query/src/services`;
  return {
    name,
    plan: (await import(`${dir}/trace-query-plan.ts`)) as PlatformArm['plan'],
    traces: (await import(`${dir}/trace-query.ts`)) as PlatformArm['traces'],
    spans: (await import(`${dir}/span-query.ts`)) as PlatformArm['spans'],
  };
}

// ---------------------------------------------------------------------------
// Request deadline: our statements and pauses don't count against Platform's 9 s budget
// ---------------------------------------------------------------------------

let frozenMs = 0;
const realNow = performance.now.bind(performance);
function suspendRequestDeadline(): void {
  performance.now = () => realNow() - frozenMs;
  // runTraceQuery races each statement against AbortSignal.timeout(9 s); the server-side limit is Tier 1 instead.
  AbortSignal.timeout = () => new AbortController().signal;
}

// ---------------------------------------------------------------------------
// Tenant fence check (fail closed)
// ---------------------------------------------------------------------------

export class FenceError extends Error {}

const DELTA_HEAD = /^SELECT toString\(max\(cursorId\)\) AS cursorId FROM mastra_trace_roots_delta$/;

const KEY_LIST = '{page:Array(Tuple(';

/** The text of the SELECT a scan at `start` belongs to: up to the parenthesis that closes it. */
function enclosingSelect(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth < 0) return text.slice(start, i);
  }
  return text.slice(start);
}

/** Drops nested `(SELECT …)` / `(WITH …)` groups so a subquery's fence can't vouch for the outer scan. */
function withoutSubqueries(text: string): string {
  for (;;) {
    const match = /\(\s*(SELECT|WITH)\b/.exec(text);
    if (!match) return text;
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++;
      else if (text[end] === ')' && --depth === 0) break;
    }
    text = `${text.slice(0, match.index)}(subquery)${text.slice(end + 1)}`;
  }
}

/**
 * Every `FROM mastra_*` scan must carry, in its own SELECT (not a nested subquery), an org fence and a project fence
 * bound to this project, or read an exact key list (a `{page:Array(Tuple(...))}` parameter) whose every tuple starts
 * with this org and project. Every fence parameter in the statement must be bound to this project. The global delta
 * head (one `max(cursorId)`, unscoped by design in #3499) is the only exception.
 */
export function assertFenced(sql: string, params: Json, scope: Scope): void {
  const text = sql.replace(/\s+/g, ' ').trim();
  if (DELTA_HEAD.test(text)) return;
  const fence = (field: 'organizationId' | 'projectId') => new RegExp(`\\b${field} = \\{(\\w+):String\\}`, 'g');
  for (const [field, expected] of [
    ['organizationId', scope.organizationId],
    ['projectId', scope.projectId],
  ] as const) {
    for (const match of text.matchAll(fence(field))) {
      if (params[match[1]!] !== expected) throw new FenceError(`${field} fence bound to another tenant`);
    }
  }
  if (text.includes(KEY_LIST)) {
    const page = params.page as Array<{ values?: unknown[] }> | undefined;
    if (!Array.isArray(page)) throw new FenceError('key list parameter missing');
    for (const tuple of page) {
      const values = tuple.values ?? [];
      if (values[0] !== scope.organizationId || values[1] !== scope.projectId)
        throw new FenceError('key list holds another tenant');
    }
  }
  for (const scan of text.matchAll(/\b(?:FROM|JOIN) (mastra_\w+)/g)) {
    const own = withoutSubqueries(enclosingSelect(text, scan.index!));
    const fenced = (fence('organizationId').test(own) && fence('projectId').test(own)) || own.includes(KEY_LIST);
    if (!fenced) throw new FenceError(`unfenced scan of ${scan[1]}`);
  }
}

// ---------------------------------------------------------------------------
// Client adapter
// ---------------------------------------------------------------------------

export interface PlatformRecord {
  runId: string;
  exp: string;
  kind: 'ab' | 'equiv';
  caseId: string;
  arm: string;
  window: string;
  bucket: string;
  hash: string;
  rep?: number;
  cold?: boolean;
  /** ab: statement index within the request and its shape. */
  index?: number;
  statement?: string;
  ok: boolean;
  errorCode?: string;
  errorCategory?: string;
  wallMs?: number;
  metrics?: QueryMetrics;
  /** Platform's own per-statement memory cap for this statement (512 MiB, discovery 256 MiB). */
  capBytes?: number;
  over?: { cap: boolean; gib: boolean; s9: boolean };
  /** ab: the request as a whole. */
  request?: { ok: boolean; error?: string; statements: number; wallMs: number };
  data?: Json;
  note?: string;
  ts: string;
}

interface Session {
  client: BenchClient;
  runId: string;
  exp: string;
  anchorTo: string;
  sidecar: Sidecar | undefined;
  /** Per worker: when this worker's last statement ended (pacing). */
  lastEnd: number;
  /** Shared by every worker of the session. */
  counts: { statements: number; overloads: number; consecutiveErrors: number };
  budget: number;
  paceMs: number;
  /** Raises only `max_memory_usage` above Tier 1's, so peaks past 4 GiB are measured. */
  maxMemoryBytes?: number;
  pinnedHead?: string;
  /** Compile and fence-check only; no statement reaches ClickHouse. */
  dry?: boolean;
  /** Print `EXPLAIN <explain>` for each statement instead of running it; nothing is recorded. */
  explain?: string;
  dryStatements?: Map<string, number>;
}

let dryRun = false;
function append(record: PlatformRecord): void {
  if (dryRun) return;
  appendFileSync(PLATFORM_FILE, `${JSON.stringify(record)}\n`);
}

/** Statement shape from its SQL text; the names are stable across the base and the rewrite. */
export function statementKind(sql: string): string {
  const text = sql.replace(/\s+/g, ' ');
  if (DELTA_HEAD.test(text.trim())) return 'head';
  if (/FROM mastra_metric_events/.test(text)) return 'span-metrics';
  if (/\{page:Array\(Tuple\(/.test(text)) return /FROM mastra_span_events/.test(text) ? 'span-payload' : 'payload';
  if (/uniqExact\(/.test(text) && !/ORDER BY/.test(text)) return 'total';
  if (/^WITH .*per_trace AS \(/.test(text)) return 'keys';
  if (/^SELECT .*FROM mastra_trace_roots r WHERE \(/.test(text)) return 'rows';
  return 'main';
}

class StatementBudgetExhausted extends Error {}

interface Capture {
  index: number;
  statement: string;
  outcome: QueryOutcome<Json>;
  capBytes: number;
}

/**
 * A `ClickHouseClient` look-alike for Platform's `runTraceQuery` (the only caller in these paths): `query()` with
 * `{ query, query_params, clickhouse_settings }`, then `json()` / `close()` on the result.
 */
function adapter(session: Session, scope: Scope, cold: boolean, captures: Capture[], tag: string) {
  return {
    async query(args: {
      query: string;
      query_params?: Json;
      clickhouse_settings?: Record<string, unknown>;
    }): Promise<{ json(): Promise<Json[]>; close(): void; response_headers: Json }> {
      const params = rewrapTuples(args.query_params ?? {});
      assertFenced(args.query, params, scope);
      const statement = statementKind(args.query);
      const index = captures.length;
      if (statement === 'head' && session.pinnedHead !== undefined) {
        captures.push({ index, statement, outcome: pinned(session.pinnedHead), capBytes: 0 });
        return result([{ cursorId: session.pinnedHead }]);
      }
      if (session.dry) {
        const counts = session.dryStatements!;
        counts.set(`${tag.split(':')[0]}:${statement}`, (counts.get(`${tag.split(':')[0]}:${statement}`) ?? 0) + 1);
        return result(statement === 'head' ? [{ cursorId: '0' }] : []);
      }
      if (session.counts.statements >= session.budget) throw new StatementBudgetExhausted();
      const platformSettings = args.clickhouse_settings ?? {};
      const max_memory_usage = platformSettings.max_memory_usage;
      // Only format and read-path settings pass through; every limit stays the Tier's.
      const settings = Object.fromEntries(
        Object.entries(platformSettings).filter(([name]) => FORWARDED_SETTINGS.has(name)),
      );
      if (session.explain) {
        const plan = await session.client.rows<{ explain: string }>(
          `EXPLAIN ${session.explain} ${args.query}`,
          params,
          {
            tier,
            logComment: ['aqa-bench', session.runId, session.exp, tag, index, 'explain'].join(':'),
            settings: settings as Record<string, string>,
          },
        );
        console.log(`--- ${tag} #${index} ${statement}`);
        console.log(plan.ok ? plan.rows!.map(r => r.explain).join('\n') : `explain failed: code ${plan.errorCode}`);
        return result(statement === 'head' ? [{ cursorId: '0' }] : []);
      }
      const started = realNow();
      const wait = session.lastEnd + session.paceMs - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      let outcome: QueryOutcome<Json>;
      for (let attempt = 0; ; attempt++) {
        session.counts.statements++;
        outcome = await session.client.rows<Json>(args.query, params, {
          tier,
          logComment: ['aqa-bench', session.runId, session.exp, tag, index, statement].join(':'),
          cold,
          settings: {
            ...(settings as Record<string, string>),
            ...(session.maxMemoryBytes ? { max_memory_usage: String(session.maxMemoryBytes) } : {}),
          },
        });
        session.lastEnd = Date.now();
        if (!outcome.ok && isOverloadOutcome(outcome)) {
          session.counts.overloads++;
          log(`overload (${session.counts.overloads}); pausing ${OVERLOAD_PAUSE_MS / 1000}s`);
          if (session.counts.overloads >= 3) throw new Error('Replica rejected 3 queries under load; stopping');
          await new Promise(r => setTimeout(r, OVERLOAD_PAUSE_MS));
          if (attempt === 0) continue;
        }
        break;
      }
      frozenMs += realNow() - started;
      captures.push({ index, statement, outcome, capBytes: Number(max_memory_usage ?? 0) });
      if (!outcome.ok) {
        session.counts.consecutiveErrors += outcome.errorCategory === 'other' ? 1 : 0;
        if (session.counts.consecutiveErrors >= 3)
          throw new Error(`3 consecutive non-limit errors (last: code ${outcome.errorCode})`);
        throw Object.assign(new Error(`statement failed: ${outcome.errorCategory}`), { code: outcome.errorCode });
      }
      session.counts.consecutiveErrors = 0;
      return result(outcome.rows ?? []);
    },
  };
}

const FORWARDED_SETTINGS = new Set([
  'date_time_input_format',
  'date_time_output_format',
  'use_client_time_zone',
  'output_format_json_quote_64bit_integers',
  'filesystem_prefetches_limit',
  'enable_shared_storage_snapshot_in_query',
]);

/**
 * Platform builds key lists with its own copy of `TupleParam`; the client formats tuples by `instanceof`, so they
 * are rebuilt with the bench client's class.
 */
function rewrapTuples(params: Json): Json {
  const wrap = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(wrap);
    if (value && typeof value === 'object' && value.constructor?.name === 'TupleParam') {
      return new TupleParam((value as { values: unknown[] }).values.map(wrap));
    }
    return value;
  };
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, wrap(value)]));
}

function isOverloadOutcome(outcome: QueryOutcome<unknown>): boolean {
  if (outcome.errorCode && ['202', '203', '209', '210'].includes(outcome.errorCode)) return true;
  if (outcome.errorCode === '241')
    return /\(total\)|total memory limit|OvercommitTracker/i.test(outcome.errorMessage ?? '');
  return !outcome.errorCode && /ECONNRESET|socket hang up|\b(429|503)\b/i.test(outcome.errorMessage ?? '');
}

function result(rows: Json[]) {
  return { json: async () => rows, close: () => undefined, response_headers: {} };
}

function pinned(head: string): QueryOutcome<Json> {
  return { queryId: '', wallMs: 0, ok: true, streamedRows: 1, streamedBytes: 0, rows: [{ cursorId: head }] };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

type Api = 'traces' | 'page' | 'groups' | 'delta' | 'threads' | 'spans' | 'fields' | 'values';

interface Request {
  api: Api;
  run(arm: PlatformArm, client: unknown, after?: string): Promise<Json>;
  /** Cursor of the next page in a response, for walks. */
  next(response: Json): string | null;
}

function buildRequest(session: Session, caseId: string, project: SelectedProject, windowId: string): Request | string {
  const def = caseById(caseId);
  const literals = literalsFor(project, session.sidecar);
  const missing = (def.needs ?? []).filter(k => literals[k] === null);
  if (missing.length) return `literal not found: ${missing.join(', ')}`;
  const timeRange = timeRangeFor(WINDOWS[windowId as keyof typeof WINDOWS], new Date(session.anchorTo));
  const request = def.request(literals);
  const scope: Scope = { organizationId: project.organizationId, projectId: project.projectId };
  const withAfter = (body: Json, after?: string): Json =>
    after === undefined
      ? body
      : 'page' in body
        ? { ...body, page: { ...(body.page as Json), after } }
        : { ...body, after };
  switch (def.api) {
    case 'traces':
    case 'page':
    case 'groups':
    case 'delta': {
      const body: Json = { timeRange, ...request };
      return {
        api: def.api,
        async run(arm, client, after) {
          let input = withAfter(body, after);
          if (def.api === 'delta' && after === undefined) {
            // From watermark 0: every change still in the delta index (2 days), up to the pinned head.
            input = {
              ...body,
              after: arm.plan.encodePlatformTraceQueryDeltaCursor(arm.plan.planPlatformTraceQuery(body, scope), '0'),
            };
          }
          return arm.traces.queryTraces(client, arm.plan.planPlatformTraceQuery(input, scope));
        },
        next: response =>
          def.api === 'delta'
            ? (response.delta as Json).hasMore
              ? String(response.deltaCursor)
              : null
            : (((response.page as Json | undefined)?.next as string | null | undefined) ?? null),
      };
    }
    case 'threads': {
      const body: Json = { ...request, traces: { timeRange, ...((request.traces as Json | undefined) ?? {}) } };
      return {
        api: 'threads',
        run: (arm, client, after) =>
          arm.traces.queryThreads(client, arm.plan.planPlatformThreadQuery(withAfter(body, after), scope)),
        next: response => ((response.page as Json).next as string | null) ?? null,
      };
    }
    case 'spans': {
      const body: Json = { timeRange, ...request };
      return {
        api: 'spans',
        run: (arm, client, after) =>
          arm.spans.querySpans(client, arm.plan.planPlatformSpanQuery(withAfter(body, after), scope)),
        next: response => ((response.page as Json).next as string | null) ?? null,
      };
    }
    case 'fields':
      return {
        api: 'fields',
        run: (arm, client) =>
          arm.traces.queryFields(client, arm.plan.planPlatformTraceQueryFields({ timeRange, ...request }, scope)),
        next: () => null,
      };
    case 'values':
      return {
        api: 'values',
        run: (arm, client) =>
          arm.traces.queryValues(client, arm.plan.planPlatformTraceQueryValues({ timeRange, ...request }, scope)),
        next: () => null,
      };
    default:
      return `${caseId} (${def.api}) has no Platform endpoint`;
  }
}

interface Executed {
  ok: boolean;
  error?: string;
  response?: Json;
  captures: Capture[];
  wallMs: number;
}

async function execute(
  session: Session,
  arm: PlatformArm,
  request: Request,
  project: SelectedProject,
  tag: string,
  cold = false,
  after?: string,
): Promise<Executed> {
  const captures: Capture[] = [];
  const scope = { organizationId: project.organizationId, projectId: project.projectId };
  const started = realNow();
  try {
    const response = await request.run(arm, adapter(session, scope, cold, captures, tag), after);
    return { ok: true, response, captures, wallMs: captureWall(captures, started) };
  } catch (error) {
    if (error instanceof FenceError || error instanceof StatementBudgetExhausted) throw error;
    if (error instanceof Error && /consecutive|under load/.test(error.message)) throw error;
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, error: name, captures, wallMs: captureWall(captures, started) };
  }
}

/** Server-side duration of the request's statements (pauses excluded). */
function captureWall(captures: Capture[], _started: number): number {
  return Math.round(
    captures.reduce((sum, c) => sum + (c.outcome.ok ? fromSummary(c.outcome).durationMs : c.outcome.wallMs), 0),
  );
}

/** The cursor `depth` rows in (K2, TH6), walked with the old arm's own pages of 1000. */
async function walkTo(
  session: Session,
  arm: PlatformArm,
  caseId: string,
  project: SelectedProject,
  windowId: string,
): Promise<string | null | undefined | 'walk-failed'> {
  const def = caseById(caseId);
  if (!def.depth) return undefined;
  const hop = withLimit(buildRequest(session, caseId, project, windowId) as Request, 1000);
  let after: string | undefined;
  for (let seen = 0; seen < def.depth; seen += 1000) {
    const executed = await execute(session, arm, hop, project, `walk:${caseId}`, false, after);
    if (!executed.ok || !executed.response) return 'walk-failed';
    const next = hop.next(executed.response);
    if (!next) return null;
    after = next;
  }
  return after;
}

/** A request whose keyset page holds `limit` rows. */
function withLimit(request: Request, limit: number): Request {
  return {
    ...request,
    run: async (arm, client, after) => {
      const original = arm.plan;
      const patch = (input: unknown) => {
        const body = input as Json;
        return { ...body, page: { ...(body.page as Json), limit } };
      };
      const scoped: PlatformArm = {
        ...arm,
        plan: {
          ...original,
          planPlatformTraceQuery: (input, scope) => original.planPlatformTraceQuery(patch(input), scope),
          planPlatformThreadQuery: (input, scope) => original.planPlatformThreadQuery(patch(input), scope),
          planPlatformSpanQuery: (input, scope) => original.planPlatformSpanQuery(patch(input), scope),
        },
      };
      return request.run(scoped, client, after);
    },
  };
}

// ---------------------------------------------------------------------------
// ship
// ---------------------------------------------------------------------------

function recordStatements(
  session: Session,
  executed: Executed,
  meta: Omit<PlatformRecord, 'runId' | 'exp' | 'kind' | 'ok' | 'ts'>,
) {
  for (const capture of executed.captures) {
    const m = fromSummary(capture.outcome);
    const memory = m.memoryBytes ?? 0;
    const record: PlatformRecord = {
      runId: session.runId,
      exp: session.exp,
      kind: 'ab',
      ...meta,
      index: capture.index,
      statement: capture.statement,
      ok: capture.outcome.ok,
      errorCode: capture.outcome.errorCode,
      errorCategory: capture.outcome.errorCategory,
      wallMs: Math.round(capture.outcome.wallMs),
      metrics: m,
      capBytes: capture.capBytes,
      over: {
        cap: capture.capBytes > 0 && memory > capture.capBytes,
        gib: memory > 1024 * MiB,
        s9: m.durationMs > 9_000 || capture.outcome.errorCategory === 'timeout',
      },
      request: {
        ok: executed.ok,
        error: executed.error,
        statements: executed.captures.length,
        wallMs: executed.wallMs,
      },
      ts: new Date().toISOString(),
    };
    append(record);
    log(
      `${meta.caseId} ${meta.bucket}:${meta.hash} ${meta.window} ${meta.arm}${meta.cold ? ' cold' : ` rep${meta.rep}`} ` +
        `#${capture.index} ${capture.statement}: ` +
        (capture.outcome.ok
          ? `${(memory / MiB).toFixed(1)} MiB, ${(m.readBytes / 1e6).toFixed(1)} MB, ${Math.round(m.durationMs)} ms`
          : `FAILED ${capture.outcome.errorCategory} (code ${capture.outcome.errorCode})`),
    );
  }
  if (!executed.ok && executed.captures.every(c => c.outcome.ok)) {
    log(`${meta.caseId} ${meta.bucket}:${meta.hash} ${meta.window} ${meta.arm}: request failed (${executed.error})`);
  }
}

/** Cells (exp, case, target, window) already measured in an earlier session of the same experiment. */
function doneCells(exp: string): Set<string> {
  const done = new Set<string>();
  for (const r of readRecords<PlatformRecord>(PLATFORM_FILE)) {
    if (r.exp === exp && r.kind === 'ab' && r.note === 'cell-done') done.add(`${r.caseId}|${r.hash}|${r.window}`);
  }
  return done;
}

/** True when an earlier window of this cell's case/project already failed every warm run of the old arm. */
function failedSmallerWindow(exp: string, caseId: string, hash: string, windowId: string): boolean {
  const order = ['1d', '7d', '30d'];
  const before = order.slice(0, order.indexOf(windowId));
  return readRecords<PlatformRecord>(PLATFORM_FILE).some(
    r =>
      r.exp === exp &&
      r.note === 'cell-done' &&
      r.caseId === caseId &&
      r.hash === hash &&
      before.includes(r.window) &&
      (r.data as Json | undefined)?.allFailed === true,
  );
}

/**
 * Cells run on `concurrency` workers; inside a cell the arms' reps stay back to back (ABAB on one project).
 * `coldOnly` runs just the cold reps, serially, for cells whose cold reps a concurrent warm pass skipped.
 */
async function ship(
  session: Session,
  arms: PlatformArm[],
  cases: string[],
  targets: SelectedProject[],
  windows: string[],
  reps: number,
  cold: boolean,
  skipAfterFailure: boolean,
  concurrency: number,
  coldOnly: boolean,
) {
  const done = coldOnly ? coldDoneCells(session.exp, arms) : doneCells(session.exp);
  const cells = targets.flatMap(project =>
    windows.flatMap(windowId => cases.map(caseId => ({ project, windowId, caseId }))),
  );
  const queue = cells.filter(c => !done.has(`${c.caseId}|${c.project.hash}|${c.windowId}`));
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    const worker: Session = Object.create(session);
    worker.lastEnd = 0;
    worker.pinnedHead = undefined;
    for (let cell = queue.shift(); cell; cell = queue.shift()) {
      await shipCell(
        worker,
        arms,
        cell.caseId,
        cell.project,
        cell.windowId,
        reps,
        cold || coldOnly,
        skipAfterFailure,
        coldOnly,
      );
    }
  });
  await Promise.all(workers);
}

async function shipCell(
  session: Session,
  arms: PlatformArm[],
  caseId: string,
  project: SelectedProject,
  windowId: string,
  reps: number,
  cold: boolean,
  skipAfterFailure: boolean,
  coldOnly: boolean,
) {
  const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
  if (skipAfterFailure && windowId !== '1d' && failedSmallerWindow(session.exp, caseId, project.hash, windowId)) {
    append({
      runId: session.runId,
      exp: session.exp,
      kind: 'ab',
      ...meta,
      arm: '-',
      ok: false,
      note: 'skipped: smaller window failed',
      ts: new Date().toISOString(),
    });
    log(`${caseId} ${project.bucket}:${project.hash} ${windowId}: skipped (smaller window failed)`);
    return;
  }
  const request = buildRequest(session, caseId, project, windowId);
  if (typeof request === 'string') {
    append({
      runId: session.runId,
      exp: session.exp,
      kind: 'ab',
      ...meta,
      arm: '-',
      ok: false,
      note: `skipped: ${request}`,
      ts: new Date().toISOString(),
    });
    log(`${caseId} ${project.bucket}:${project.hash} ${windowId}: skipped (${request})`);
    return;
  }
  session.pinnedHead = request.api === 'delta' || request.api === 'page' ? await deltaHead(session) : undefined;
  const after = await walkTo(session, arms[0]!, caseId, project, windowId);
  if (after === null || after === 'walk-failed') {
    const note = after === null ? 'skipped: fewer rows than the cursor depth' : 'skipped: cursor walk failed';
    append({
      runId: session.runId,
      exp: session.exp,
      kind: 'ab',
      ...meta,
      arm: '-',
      ok: false,
      note,
      ts: new Date().toISOString(),
    });
    log(`${caseId} ${project.bucket}:${project.hash} ${windowId}: ${note}`);
    return;
  }
  let failures = 0;
  let runs = 0;
  const order = (rep: number) => (rep % 2 === 0 ? arms : [...arms].reverse());
  if (cold) {
    for (const arm of arms) {
      const executed = await execute(session, arm, request, project, `${caseId}:cold`, true, after);
      recordStatements(session, executed, { ...meta, arm: arm.name, cold: true });
    }
  }
  for (let rep = 0; rep < (coldOnly ? 0 : reps); rep++) {
    for (const arm of order(rep)) {
      const executed = await execute(session, arm, request, project, `${caseId}:${rep}`, false, after);
      recordStatements(session, executed, { ...meta, arm: arm.name, rep });
      if (arm.name === 'old') {
        runs++;
        if (!executed.ok) failures++;
      }
    }
  }
  append({
    runId: session.runId,
    exp: session.exp,
    kind: 'ab',
    ...meta,
    arm: '-',
    ok: true,
    note: coldOnly ? 'cell-done-cold' : 'cell-done',
    data: { allFailed: runs > 0 && failures === runs },
    ts: new Date().toISOString(),
  });
}

/** Cells whose cold reps were recorded for every arm (in a serial pass or a session that ran them inline). */
function coldDoneCells(exp: string, arms: PlatformArm[]): Set<string> {
  const seen = new Map<string, Set<string>>();
  for (const r of readRecords<PlatformRecord>(PLATFORM_FILE)) {
    if (r.exp !== exp || r.kind !== 'ab') continue;
    const key = `${r.caseId}|${r.hash}|${r.window}`;
    if (r.note === 'cell-done-cold') arms.forEach(a => seen.set(key, new Set([...(seen.get(key) ?? []), a.name])));
    else if (r.cold && r.statement) seen.set(key, new Set([...(seen.get(key) ?? []), r.arm]));
  }
  return new Set([...seen].filter(([, names]) => arms.every(a => names.has(a.name))).map(([key]) => key));
}

/** The current delta head, read once per cell so every arm and rep pages to the same watermark. */
async function deltaHead(session: Session): Promise<string> {
  if (session.dry) return '0';
  const wait = session.lastEnd + session.paceMs - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  session.counts.statements++;
  const outcome = await session.client.rows<{ cursorId: string }>(
    'SELECT toString(max(cursorId)) AS cursorId FROM mastra_trace_roots_delta',
    {},
    { tier, logComment: ['aqa-bench', session.runId, session.exp, 'head'].join(':') },
  );
  session.lastEnd = Date.now();
  if (!outcome.ok || !outcome.rows?.[0]) throw new Error(`delta head failed (code ${outcome.errorCode})`);
  return outcome.rows[0].cursorId;
}

// ---------------------------------------------------------------------------
// equiv
// ---------------------------------------------------------------------------

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

/** The list a response pages over, for set comparison and mismatch classification. */
function items(response: Json): Json[] {
  for (const key of ['traces', 'groups', 'threads', 'spans', 'values', 'observedFields']) {
    if (Array.isArray(response[key])) return response[key] as Json[];
  }
  return [];
}

function itemKey(item: Json): string {
  return JSON.stringify([item.projectId, item.traceId ?? item.threadId ?? item.spanId ?? item.value ?? item.path]);
}

interface Walk {
  ok: boolean;
  error?: string;
  pages: string[];
  set: string;
  keys: string[];
  totals: unknown[];
  count: number;
}

async function walk(
  session: Session,
  arm: PlatformArm,
  request: Request,
  project: SelectedProject,
  caseId: string,
  pages: number,
): Promise<Walk> {
  const out: Walk = { ok: true, pages: [], set: '', keys: [], totals: [], count: 0 };
  const all: string[] = [];
  let after: string | undefined;
  for (let i = 0; i < pages; i++) {
    const executed = await execute(session, arm, request, project, `equiv:${caseId}:${arm.name}:${i}`, false, after);
    if (!executed.ok || !executed.response) return { ...out, ok: false, error: executed.error ?? 'failed' };
    const response = executed.response;
    const list = items(response);
    // Cursors are opaque but deterministic for a position; hashing the whole response compares them too.
    out.pages.push(sha(response));
    out.totals.push((response.pagination as Json | undefined)?.total ?? null);
    out.count += list.length;
    for (const item of list) {
      out.keys.push(itemKey(item));
      all.push(sha(item));
    }
    const next = request.next(response);
    if (!next) break;
    after = next;
  }
  out.set = sha([...all].sort());
  return out;
}

async function equiv(
  session: Session,
  arms: PlatformArm[],
  cases: string[],
  targets: SelectedProject[],
  windows: string[],
  pages: number,
) {
  const [old, next] = arms;
  if (!old || !next) throw new Error('equiv needs --old and --new');
  for (const project of targets) {
    for (const windowId of windows) {
      for (const caseId of cases) {
        const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
        const request = buildRequest(session, caseId, project, windowId);
        if (typeof request === 'string') {
          log(`${caseId} ${project.bucket}:${project.hash} ${windowId}: skipped (${request})`);
          continue;
        }
        session.pinnedHead = request.api === 'delta' || request.api === 'page' ? await deltaHead(session) : undefined;
        const a = await walk(session, old, request, project, caseId, pages);
        const b = await walk(session, next, request, project, caseId, pages);
        const control = await walk(session, old, request, project, caseId, pages);
        const controlStable = a.ok && control.ok && JSON.stringify(a.pages) === JSON.stringify(control.pages);
        const match = a.ok && b.ok && JSON.stringify(a.pages) === JSON.stringify(b.pages);
        const setMatch = a.ok && b.ok && a.set === b.set;
        const totalsMatch = JSON.stringify(a.totals) === JSON.stringify(b.totals);
        let differing: Json | undefined;
        if (a.ok && b.ok && !match) differing = await classify(session, project, a, b, request.api);
        const record: PlatformRecord = {
          runId: session.runId,
          exp: session.exp,
          kind: 'equiv',
          ...meta,
          arm: 'old-vs-new',
          ok: a.ok && b.ok,
          data: {
            match,
            setMatch,
            totalsMatch,
            controlStable,
            pages: [a.pages.length, b.pages.length],
            rows: [a.count, b.count],
            errors: [a.error ?? null, b.error ?? null, control.error ?? null],
            ...(differing ? { differing } : {}),
          },
          ts: new Date().toISOString(),
        };
        append(record);
        log(`${caseId} ${project.bucket}:${project.hash} ${windowId}: ${JSON.stringify(record.data)}`);
      }
    }
  }
}

/**
 * Counts of differing traces by how many distinct root spans each has in the project (aggregate only; the trace ids
 * stay in memory). Positions that differ only in order are counted as `reordered`.
 */
async function classify(session: Session, project: SelectedProject, a: Walk, b: Walk, api: Api): Promise<Json> {
  const left = new Set(a.keys);
  const right = new Set(b.keys);
  const onlyOld = a.keys.filter(k => !right.has(k));
  const onlyNew = b.keys.filter(k => !left.has(k));
  const changed = a.keys.filter((k, i) => b.keys[i] !== k).length;
  const ids = [...new Set([...onlyOld, ...onlyNew].map(k => (JSON.parse(k) as string[])[1]!))];
  const out: Json = { onlyOld: onlyOld.length, onlyNew: onlyNew.length, positions: changed };
  if (!ids.length || !['traces', 'page', 'delta'].includes(api)) return out;
  const wait = session.lastEnd + session.paceMs - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  session.counts.statements++;
  const outcome = await session.client.rows<{ multi: string; single: string }>(
    `SELECT countIf(roots > 1) AS multi, countIf(roots <= 1) AS single FROM (
       SELECT traceId, uniqExact(spanId) AS roots FROM mastra_trace_roots
       WHERE organizationId = {org:String} AND projectId = {project:String} AND traceId IN {ids:Array(String)}
       GROUP BY traceId)`,
    { org: project.organizationId, project: project.projectId, ids },
    { tier, logComment: ['aqa-bench', session.runId, session.exp, 'classify'].join(':') },
  );
  session.lastEnd = Date.now();
  if (outcome.ok && outcome.rows?.[0]) {
    out.multiRoot = Number(outcome.rows[0].multi);
    out.singleRoot = Number(outcome.rows[0].single);
  }
  return out;
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

function summarize(records: PlatformRecord[], exp: string): string {
  const rows = records.filter(r => r.exp === exp && r.kind === 'ab' && r.statement);
  const groups = new Map<string, PlatformRecord[]>();
  for (const r of rows) {
    const key = [
      r.caseId,
      `${r.bucket}:${r.hash}`,
      r.window,
      r.arm,
      r.cold ? 'cold' : 'warm',
      r.index,
      r.statement,
    ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out = [
    'case | target | window | arm | run | # | statement | MiB (median) | MB read | ms | fails | >cap | >1GiB | >9s',
  ];
  for (const [key, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const ok = list.filter(r => r.ok);
    const mib = ok.length ? median(ok.map(r => (r.metrics?.memoryBytes ?? 0) / MiB)) : NaN;
    const mb = ok.length ? median(ok.map(r => (r.metrics?.readBytes ?? 0) / 1e6)) : NaN;
    const ms = median(list.map(r => (r.ok ? (r.metrics?.durationMs ?? 0) : (r.wallMs ?? 0))));
    const fails = list.filter(r => !r.ok).map(r => r.errorCategory);
    // A Tier 1 memory failure is over 4 GiB, and a Tier 1 timeout over 30 s: past every cap.
    const oom = fails.includes('memory');
    const slow = fails.includes('timeout');
    const memory = ok.length ? mib.toFixed(1) : oom ? '>4096' : '-';
    out.push(
      `${key.split('|').join(' | ')} | ${memory} | ${ok.length ? mb.toFixed(1) : '-'} | ${Math.round(ms)} | ${fails.join(',') || '-'} | ` +
        `${oom || list.some(r => r.over?.cap) ? 'Y' : ''} | ${oom || list.some(r => r.over?.gib) ? 'Y' : ''} | ${slow || list.some(r => r.over?.s9) ? 'Y' : ''}`,
    );
  }
  const skipped = records.filter(r => r.exp === exp && r.note?.startsWith('skipped'));
  for (const r of skipped) out.push(`${r.caseId} | ${r.bucket}:${r.hash} | ${r.window} | ${r.note}`);
  const equivs = records.filter(r => r.exp === exp && r.kind === 'equiv');
  for (const r of equivs)
    out.push(`equiv ${r.caseId} | ${r.bucket}:${r.hash} | ${r.window} | ${JSON.stringify(r.data)}`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function otherBenchProcesses(): string[] {
  try {
    const ps = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    return ps
      .split('\n')
      .filter(l =>
        /node .*bench\/(aggregate-traces\/(run|floor|lab|retries)|trace-query\/(run|experiments))\.ts/.test(l),
      )
      .filter(l => !/ (summary|down|up|calibrate)( |$)/.test(l));
  } catch {
    return [];
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      exp: { type: 'string', default: 'QX25' },
      old: { type: 'string' },
      new: { type: 'string' },
      anchor: { type: 'string' },
      cases: { type: 'string', default: 'T0' },
      targets: { type: 'string', default: 'p99' },
      windows: { type: 'string', default: '1d' },
      reps: { type: 'string', default: '3' },
      cold: { type: 'boolean', default: false },
      pages: { type: 'string', default: '3' },
      budget: { type: 'string', default: '300' },
      concurrency: { type: 'string', default: '1' },
      'pace-ms': { type: 'string', default: '3000' },
      'cold-only': { type: 'boolean', default: false },
      'max-memory-gib': { type: 'string' },
      'skip-after-failure': { type: 'boolean', default: true },
      'allow-shared': { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
      explain: { type: 'string' },
    },
  });
  const command = positionals[0];
  mkdirSync(RESULTS_DIR, { recursive: true });
  if (command === 'summary') {
    console.log(summarize(readRecords<PlatformRecord>(PLATFORM_FILE), values.exp!));
    return;
  }
  if (command !== 'ship' && command !== 'equiv') throw new Error(`Unknown command ${command}`);
  const others = values.dry ? [] : otherBenchProcesses();
  if (others.length && !values['allow-shared']) {
    throw new Error(
      `${others.length} other bench process(es) are running against the replica; wait or pass --allow-shared`,
    );
  }
  if (!values.old && !values.new) throw new Error('--old and/or --new <platform checkout> is required');
  const arms: PlatformArm[] = [];
  if (values.old) arms.push(await loadArm('old', values.old));
  if (values.new) arms.push(await loadArm('new', values.new));
  suspendRequestDeadline();
  dryRun = values.dry! || Boolean(values.explain);
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run the aggregate profile first');
  const client = values.dry
    ? ({ close: async () => undefined } as unknown as BenchClient)
    : connect(loadCredentials(), readJson<Preflight>(files(RESULTS_DIR).preflight).database);
  const session: Session = {
    client,
    runId: `${values.exp}-${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14)}`,
    exp: values.exp!,
    anchorTo: values.anchor ? new Date(values.anchor).toISOString() : selection.anchorTo,
    sidecar: loadSidecar(),
    lastEnd: 0,
    counts: { statements: 0, overloads: 0, consecutiveErrors: 0 },
    paceMs: Number(values['pace-ms']),
    budget: Number(values.budget),
    maxMemoryBytes: values['max-memory-gib'] ? Number(values['max-memory-gib']) * 2 ** 30 : undefined,
    dry: values.dry,
    explain: values.explain,
    dryStatements: new Map(),
  };
  const targets = resolveTargets(selection, values.targets!);
  const windows = values.windows!.split(',');
  const cases = values.cases!.split(',');
  log(
    `${command} ${session.exp} run ${session.runId}: arms [${arms.map(a => a.name).join(', ')}] cases [${cases.join(', ')}] ` +
      `targets [${targets.map(t => `${t.bucket}:${t.hash}`).join(', ')}] windows [${windows.join(', ')}] budget ${session.budget}`,
  );
  try {
    if (command === 'ship') {
      await ship(
        session,
        arms,
        cases,
        targets,
        windows,
        Number(values.reps),
        values.cold!,
        values['skip-after-failure']!,
        Number(values.concurrency),
        values['cold-only']!,
      );
    } else {
      await equiv(session, arms, cases, targets, windows, Number(values.pages));
    }
  } catch (error) {
    if (error instanceof StatementBudgetExhausted)
      log(`statement budget (${session.budget}) reached; rerun to continue`);
    else throw error;
  } finally {
    await client.close();
  }
  if (session.dry) {
    for (const [key, count] of [...session.dryStatements!].sort()) log(`dry ${key}: ${count}`);
    return;
  }
  log(`done: ${session.counts.statements} statements`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    process.exit(1);
  });
}

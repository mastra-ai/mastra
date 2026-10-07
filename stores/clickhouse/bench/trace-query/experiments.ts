/**
 * Memory experiments for `queryTraces()` (EXPERIMENTS.md). Read-only, sequential, paced, Tier 1 limits; records
 * go to `results/experiments.jsonl` as bucket + project hash only.
 *
 *   tsx bench/trace-query/experiments.ts census --targets small,p99,p99:62b01951,largest --windows 1d,30d
 *   tsx bench/trace-query/experiments.ts ship   --exp QX10 --legacy <old trace-query module> --cases T0,P0
 *                                               --targets small,p99 [--windows 1d,30d] [--reps 5] [--cold [--cold-reps 1]]
 *   tsx bench/trace-query/experiments.ts equiv  --exp QX10 --legacy <old trace-query module> --cases T0,P0 --targets ...
 *   tsx bench/trace-query/experiments.ts summary [--exp QX10]
 *
 * Targets: a bucket name (its representative project) or `bucket:hashprefix`. `ship` compares two queryTraces()
 * implementations — `old`, a copy of the compiler before a change (`--legacy`, e.g. `git show <rev>:<path>` saved
 * next to the current one), and `new`, the current one — by running each one's statements as the store issues them
 * (stages.ts `captureTraceQuery`), interleaved per rep (ABAB…, order reversed on odd reps) so replica drift hits
 * both alike. `equiv` compares order-sensitive and order-free hashes of their results on the server; only counts and
 * hashes return. The variant rewrites used for QX01–QX09 ran against the compiler at c677e6a9280.
 * Every command first notes any other bench process running against the replica.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { ClickHouseSettings } from '@clickhouse/client';

import { queryTraces } from '../../src/storage/domains/observability/v-next/trace-query';
import { isLimitCategory, isOverload, TIERS } from '../shared/client';
import type { BenchClient, QueryOutcome } from '../shared/client';
import { installOutputRedaction, loadCredentials } from '../shared/env';
import { fromSummary } from '../shared/metrics';
import type { QueryMetrics } from '../shared/metrics';
import { loadSelection } from '../shared/profile';
import type { SelectedProject, Selection } from '../shared/profile';
import { median } from '../shared/report-kit';
import { connect, log, readJson, readRecords } from '../shared/runner';
import type { Preflight } from '../shared/runner';
import { caseById, compileCase, DELTA_HEAD_SQL, timeRangeFor, WINDOWS } from './cases';
import type { CursorAt } from './cases';
import { literalsFor, loadSidecar } from './discover';
import type { Sidecar } from './discover';
import { files, RESULTS_DIR } from './run';
import { captureTraceQuery, deltaHead, KeyQueryFailed, traceCursorRows, walkCursor } from './stages';
import type { KeyRunner, QueryTracesFn, Statement, TraceStatements } from './stages';

export const EXPERIMENTS_FILE = `${RESULTS_DIR}/experiments.jsonl`;
const PAUSE_MS = 3_000;
const OVERLOAD_PAUSE_MS = 60_000;
const HOP = 1000;
const tier = TIERS[1];

export interface ExpRecord {
  runId: string;
  exp: string;
  kind: 'ab' | 'equiv' | 'census' | 'explain';
  /** ship: which statement of the flow (main, list, payload). */
  statement?: keyof Omit<TraceStatements, 'keyFailure'>;
  caseId?: string;
  variant?: string;
  stage?: number;
  window?: string;
  bucket?: string;
  hash?: string;
  rep?: number;
  cold?: boolean;
  ok: boolean;
  errorCode?: string;
  errorCategory?: string;
  wallMs?: number;
  metrics?: QueryMetrics;
  /** equiv: aggregate-only comparison; census: aggregate counts. */
  data?: Record<string, unknown>;
  note?: string;
  ts: string;
}

interface Ctx {
  client: BenchClient;
  runId: string;
  exp: string;
  anchorTo: string;
  sidecar: Sidecar | undefined;
  lastEnd: number;
  consecutiveErrors: number;
  overloads: number;
}

function append(record: ExpRecord): void {
  appendFileSync(EXPERIMENTS_FILE, `${JSON.stringify(record)}\n`);
}

async function exec<Row = never>(
  ctx: Ctx,
  statement: Statement,
  step: string,
  options: { cold?: boolean; parse?: boolean } = {},
): Promise<QueryOutcome<Row>> {
  for (let attempt = 0; ; attempt++) {
    const wait = ctx.lastEnd + PAUSE_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const run = {
      tier,
      logComment: ['aqa-bench', ctx.runId, ctx.exp, step].join(':'),
      cold: options.cold,
      sharedSnapshot: statement.sharedSnapshot,
      settings: statement.settings,
    };
    const outcome = options.parse
      ? await ctx.client.rows<Row>(statement.query, statement.query_params, run)
      : ((await ctx.client.discard(statement.query, statement.query_params, run)) as QueryOutcome<Row>);
    ctx.lastEnd = Date.now();
    if (!outcome.ok && isOverload(outcome)) {
      ctx.overloads++;
      log(`overload on ${step} (${ctx.overloads}); pausing ${OVERLOAD_PAUSE_MS / 1000}s`);
      if (ctx.overloads >= 3) throw new Error('Replica rejected 3 queries under load; stopping');
      await new Promise(r => setTimeout(r, OVERLOAD_PAUSE_MS));
      if (attempt === 0) continue;
    }
    if (!outcome.ok && !isLimitCategory(outcome.errorCategory ?? 'other')) {
      ctx.consecutiveErrors++;
      if (ctx.consecutiveErrors >= 3)
        throw new Error(`3 consecutive non-limit errors (last: code ${outcome.errorCode})`);
    } else {
      ctx.consecutiveErrors = 0;
    }
    return outcome;
  }
}

// ---------------------------------------------------------------------------
// targets and base statements
// ---------------------------------------------------------------------------

export function resolveTargets(selection: Selection, spec: string): SelectedProject[] {
  return spec.split(',').map(t => {
    const [bucket, prefix] = t.split(':');
    const project = selection.projects.find(
      p => p.bucket === bucket && (prefix ? p.hash.startsWith(prefix) : p.representative),
    );
    if (!project) throw new Error(`No project for target ${t}`);
    return project;
  });
}

type Arm = 'old' | 'new';
type Impls = Record<Arm, QueryTracesFn>;
const STATEMENTS = ['main', 'list', 'payload'] as const;

/** Each implementation's project-scoped statements for a case, at the cursor / watermark the benchmark uses. */
async function armStatements(
  ctx: Ctx,
  impls: Impls,
  caseId: string,
  project: SelectedProject,
  windowId: keyof typeof WINDOWS,
): Promise<Record<Arm, TraceStatements> | string> {
  const def = caseById(caseId);
  if (!['traces', 'page', 'groups', 'delta'].includes(def.api)) return `${caseId} is not a queryTraces() case`;
  const literals = literalsFor(project, ctx.sidecar);
  const missing = (def.needs ?? []).filter(k => literals[k] === null);
  if (missing.length) return `literal not found: ${missing.join(', ')}`;
  const timeRange = timeRangeFor(WINDOWS[windowId], new Date(ctx.anchorTo));
  const runKey: KeyRunner = async <Row>(statement: Statement, step: string) =>
    exec<Row>(ctx, statement, `key:${caseId}:${step}`, { parse: true });
  let cursor: CursorAt | undefined;
  let head: { cursorId: string; traceId: string } | undefined;
  try {
    if (def.api === 'delta') {
      if (def.depth) return 'delta depth not supported in experiments';
      head = await deltaHead(runKey, { query: DELTA_HEAD_SQL, query_params: {} });
      cursor = { kind: 'delta', cursorId: '0', traceId: '' };
    } else if (def.depth) {
      cursor = await walkCursor(def.depth, HOP, async at => {
        const hop = compileCase(def, 'base', literals, timeRange, project, { cursor: at, limit: HOP });
        if (hop.plan.api !== 'traces') throw new Error(`${caseId}: depth only for traces`);
        return traceCursorRows(runKey, hop.compiled, hop.plan.plan.orderBy.field as 'startedAt' | 'endedAt');
      });
      if (!cursor) return `fewer than ${def.depth} rows`;
    }
  } catch (error) {
    if (error instanceof KeyQueryFailed) return error.message;
    throw error;
  }
  const { plan } = compileCase(def, 'base', literals, timeRange, project, { cursor, deltaHead: head });
  if (plan.api !== 'traces' && plan.api !== 'page' && plan.api !== 'groups' && plan.api !== 'delta') {
    return `${caseId} is not a queryTraces() case`;
  }
  const capture = (impl: QueryTracesFn) => captureTraceQuery(impl, plan.plan, project, def.relations, runKey, head);
  return { old: await capture(impls.old), new: await capture(impls.new) };
}

// ---------------------------------------------------------------------------
// ship
// ---------------------------------------------------------------------------

async function runArm(
  ctx: Ctx,
  arm: Arm,
  statements: TraceStatements,
  meta: Omit<ExpRecord, 'runId' | 'exp' | 'kind' | 'ok' | 'ts'>,
): Promise<void> {
  for (const [index, name] of STATEMENTS.entries()) {
    const statement = statements[name];
    if (!statement) continue;
    const step = `${meta.caseId}:${arm}:${name}:${meta.window}:${meta.bucket}:${meta.hash}:${meta.rep}`;
    const outcome = await exec(ctx, statement, step, { cold: meta.cold });
    const r: ExpRecord = {
      runId: ctx.runId,
      exp: ctx.exp,
      kind: 'ab',
      ...meta,
      variant: arm,
      stage: index,
      statement: name,
      ok: outcome.ok,
      errorCode: outcome.errorCode,
      errorCategory: outcome.errorCategory,
      wallMs: Math.round(outcome.wallMs),
      metrics: fromSummary(outcome),
      ts: new Date().toISOString(),
    };
    append(r);
    const m = r.metrics!;
    log(
      `${meta.caseId} ${meta.bucket}:${meta.hash} ${meta.window} rep${meta.rep}${meta.cold ? ' cold' : ''} ${arm} ${name}: ` +
        (outcome.ok
          ? `${((m.memoryBytes ?? 0) / 2 ** 20).toFixed(1)} MiB, ${(m.readBytes / 1e6).toFixed(1)} MB, ${Math.round(m.durationMs)} ms`
          : `FAILED ${outcome.errorCategory} (code ${outcome.errorCode})`),
    );
  }
}

async function ship(
  ctx: Ctx,
  impls: Impls,
  cases: string[],
  targets: SelectedProject[],
  windows: string[],
  reps: number,
  /** Cold reps per arm, run before the warm reps (0 = warm only). */
  coldReps: number,
) {
  for (const project of targets) {
    for (const windowId of windows) {
      for (const caseId of cases) {
        const arms = await armStatements(ctx, impls, caseId, project, windowId as keyof typeof WINDOWS);
        const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
        if (typeof arms === 'string') {
          append({
            runId: ctx.runId,
            exp: ctx.exp,
            kind: 'ab',
            ...meta,
            ok: false,
            note: `skip: ${arms}`,
            ts: new Date().toISOString(),
          });
          log(`skip ${caseId} ${project.bucket} ${windowId}: ${arms}`);
          continue;
        }
        for (const arm of ['old', 'new'] as const) {
          if (arms[arm].keyFailure) log(`${caseId} ${arm}: capture stopped early (${arms[arm].keyFailure})`);
        }
        for (let rep = -coldReps; rep < reps; rep++) {
          const order: Arm[] = (rep + 2) % 2 === 0 ? ['old', 'new'] : ['new', 'old'];
          for (const arm of order) await runArm(ctx, arm, arms[arm], { ...meta, rep, cold: rep < 0 });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// equiv
// ---------------------------------------------------------------------------

export function hashStatement(statement: Statement, columns: string[]): Statement {
  return {
    ...statement,
    query: `SELECT count() AS n, toString(sum(h)) AS unordered, toString(cityHash64(groupArray(h))) AS ordered
FROM (SELECT cityHash64(tuple(${columns.join(', ')})) AS h FROM (
${statement.query}
))`,
  };
}

/** The API row's list columns (everything but the `metadata` / `input` payloads). */
export const LIST_COLUMNS = [
  'traceId',
  'rootSpanId',
  'name',
  'entityId',
  'parentSpanId',
  'threadId',
  'resourceId',
  'startedAt',
  'endedAt',
  'entityName',
  'entityType',
  'environment',
  'status',
];
export const PAYLOAD_COLUMNS = ['traceId', 'rootSpanId', 'metadata', 'input'];

/** Restricts a statement's rows (`where`) and/or keeps its first `limit` rows. */
export function slice(statement: Statement, options: { where?: string; limit?: number }): Statement {
  return {
    ...statement,
    query: `SELECT * FROM (${statement.query})${options.where ? ` WHERE ${options.where}` : ''}${options.limit !== undefined ? ` LIMIT ${options.limit}` : ''}`,
  };
}

interface HashRow {
  n: string;
  unordered: string;
  ordered: string;
}
type Hash = HashRow | { error: string };

/**
 * Old vs new results, compared on the server:
 * - the list (old: the single keyset / delta / groups statement, or page rows without the total row; new: the
 *   bounded list, or `main` for delta / groups), order-sensitive;
 * - the payloads of the returned rows (old: carried on the list rows; new: the payload lookup), as a set;
 * - page mode: the total.
 * The old list is hashed before and after the new arm, so live-data drift shows up as an unstable control.
 */
async function equiv(ctx: Ctx, impls: Impls, cases: string[], targets: SelectedProject[], windows: string[]) {
  const same = (a: Hash, b: Hash, ordered: boolean) =>
    'n' in a &&
    'n' in b &&
    String(a.n) === String(b.n) &&
    (String(a.n) === '0' || (a.unordered === b.unordered && (!ordered || a.ordered === b.ordered)));
  for (const project of targets) {
    for (const windowId of windows) {
      for (const caseId of cases) {
        const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
        const arms = await armStatements(ctx, impls, caseId, project, windowId as keyof typeof WINDOWS);
        if (typeof arms === 'string') {
          log(`skip ${caseId} ${project.bucket} ${windowId}: ${arms}`);
          continue;
        }
        const def = caseById(caseId);
        const hashOf = async (statement: Statement | undefined, columns: string[], label: string): Promise<Hash> => {
          if (!statement) return { error: 'not issued' };
          const out = await exec<HashRow>(ctx, hashStatement(statement, columns), `equiv:${caseId}:${label}`, {
            parse: true,
          });
          return out.ok ? out.rows![0]! : { error: out.errorCategory ?? 'other' };
        };
        const groups = def.api === 'groups';
        const page = def.api === 'page';
        const columns = groups
          ? ['threadId']
          : def.api === 'delta'
            ? [...LIST_COLUMNS, '__delta_cursor']
            : LIST_COLUMNS;
        const oldList = page ? slice(arms.old.main, { where: '__metadata = 0' }) : arms.old.main;
        const newList = groups || def.api === 'delta' ? arms.new.main : arms.new.list;

        const left = await hashOf(oldList, columns, 'old');
        // No list statement means the new flow saw nothing past the bound: it matches only an empty old list.
        const right = newList ? await hashOf(newList, columns, 'new') : ({ n: '0' } as Hash);
        const control = await hashOf(oldList, columns, 'old2');
        const data: Record<string, unknown> = {
          rows: 'n' in left ? Number(left.n) : null,
          newRows: 'n' in right ? Number(right.n) : null,
          // Two failures are not a match: the comparison didn't run.
          match: same(left, right, true),
          setMatch: same(left, right, false),
          controlStable: same(left, control, true),
          errors: [left, right].flatMap(h => ('error' in h ? [h.error] : [])),
        };
        if (!groups) {
          // Visible rows only: keyset / delta lists carry one look-ahead row the payload lookup skips.
          const visible =
            'n' in left
              ? Math.min(Number(left.n), def.api === 'page' ? Number(left.n) : visibleLimit(arms.old.main))
              : 0;
          const oldPayloads = page ? arms.old.payload : arms.old.main && slice(oldList, { limit: visible });
          // Neither flow looks payloads up for an empty page.
          const none = { n: '0' } as Hash;
          const a = visible === 0 && !oldPayloads ? none : await hashOf(oldPayloads, PAYLOAD_COLUMNS, 'old-payload');
          const b =
            visible === 0 && !arms.new.payload ? none : await hashOf(arms.new.payload, PAYLOAD_COLUMNS, 'new-payload');
          data.payloadMatch = same(a, b, false);
          data.payloadRows = [a, b].map(h => ('n' in h ? Number(h.n) : h.error));
        }
        if (page) {
          const total = await exec<{ total: string }>(
            ctx,
            { ...arms.old.main, query: `SELECT toString(any(total)) AS total FROM (${arms.old.main.query})` },
            `equiv:${caseId}:old-total`,
            { parse: true },
          );
          const bound = await exec<{ traces: string }>(ctx, arms.new.main, `equiv:${caseId}:new-total`, {
            parse: true,
          });
          data.totalMatch =
            total.ok && bound.ok && Number(total.rows![0]?.total ?? 0) === Number(bound.rows![0]?.traces ?? 0);
        }
        append({
          runId: ctx.runId,
          exp: ctx.exp,
          kind: 'equiv',
          ...meta,
          ok: data.match === true,
          data,
          ts: new Date().toISOString(),
        });
        log(`equiv ${caseId} ${project.bucket}:${project.hash} ${windowId}: ${JSON.stringify(data)}`);
      }
    }
  }
}

/** The page size of a keyset / delta statement: its row limit minus the look-ahead row. */
function visibleLimit(statement: Statement): number {
  const match = /LIMIT \{(trace_query_\d+):UInt64\}\s*$/.exec(statement.query);
  const limit = match ? Number(statement.query_params[match[1]!]) : NaN;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Could not read the statement row limit');
  return limit - 1;
}

// ---------------------------------------------------------------------------
// census
// ---------------------------------------------------------------------------

/**
 * How many traces have more than one root row, and whether the copies differ (in sort key, timing or the returned
 * content). Rows are every root row with a traceId seen in the project's window, across all tenants, i.e. exactly
 * what the compiled `current_roots` re-read deduplicates. Aggregate-only.
 */
export const CENSUS_SQL = `
SELECT
  count() AS traces,
  sum(n) AS rows,
  countIf(n > 1) AS multiRow,
  countIf(keys > 1) AS multiKey,
  countIf(tenants > 1) AS crossTenant,
  countIf(starts > 1) AS startDiffers,
  countIf(ends > 1) AS endDiffers,
  countIf(contents > keys) AS sameKeyContentDiffers,
  countIf(contents > 1) AS contentDiffers,
  countIf(minKeyOutside = 1) AS minKeyOutsideWindowOrTenant
FROM (
  SELECT
    traceId,
    count() AS n,
    uniqExact(dedupeKey) AS keys,
    uniqExact(organizationId, projectId) AS tenants,
    uniqExact(startedAt) AS starts,
    uniqExact(endedAt) AS ends,
    uniqExact(dedupeKey, cityHash64(spanId, name, entityId, parentSpanId, metadataRaw, input, threadId, resourceId,
      startedAt, endedAt, entityName, entityType, environment, error)) AS contents,
    argMin(NOT (organizationId = {o:String} AND projectId = {p:String} AND startedAt >= {from:DateTime64(3, 'UTC')}
      AND startedAt < {to:DateTime64(3, 'UTC')}), dedupeKey) AS minKeyOutside
  FROM mastra_trace_roots
  WHERE traceId IN (
    SELECT traceId FROM mastra_trace_roots
    WHERE organizationId = {o:String} AND projectId = {p:String}
      AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}
  )
  GROUP BY traceId
)`;

const chTime = (iso: string) => iso.replace('T', ' ').replace(/Z$/, '');

async function census(ctx: Ctx, targets: SelectedProject[], windows: string[]) {
  for (const project of targets) {
    for (const windowId of windows) {
      const range = timeRangeFor(WINDOWS[windowId as keyof typeof WINDOWS], new Date(ctx.anchorTo));
      const out = await exec<Record<string, string>>(
        ctx,
        {
          query: CENSUS_SQL,
          query_params: {
            o: project.organizationId,
            p: project.projectId,
            from: chTime(range.from),
            to: chTime(range.to),
          },
        },
        `census:${windowId}:${project.bucket}:${project.hash}`,
        { parse: true },
      );
      const data = out.ok
        ? Object.fromEntries(Object.entries(out.rows![0]!).map(([k, v]) => [k, Number(v)]))
        : undefined;
      append({
        runId: ctx.runId,
        exp: ctx.exp,
        kind: 'census',
        window: windowId,
        bucket: project.bucket,
        hash: project.hash,
        ok: out.ok,
        errorCategory: out.errorCategory,
        metrics: fromSummary(out),
        data,
        ts: new Date().toISOString(),
      });
      log(
        `census ${project.bucket}:${project.hash} ${windowId}: ${out.ok ? JSON.stringify(data) : `FAILED ${out.errorCategory}`}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

const mib = (b: number) => b / 2 ** 20;

export function summarize(records: ExpRecord[], exp?: string): string {
  const rows = records.filter(r => r.kind === 'ab' && r.metrics && (!exp || r.exp === exp));
  const groups = new Map<string, ExpRecord[]>();
  for (const r of rows) {
    const key = [r.exp, r.caseId, r.bucket, r.hash, r.window, r.variant, r.stage ?? 0].join('|');
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out = [
    '| exp | case | target | window | variant | warm MiB (n) | ×base | MB read | warm ms | cold ms | fails |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const warmMem = (rs: ExpRecord[]) =>
    median(rs.filter(r => r.ok && !r.cold).map(r => mib(r.metrics!.memoryBytes ?? 0)));
  for (const [key, rs] of groups) {
    const [e, c, bucket, hash, window, variant, stage] = key.split('|');
    const baseArm = rs[0]!.statement ? 'old' : 'base';
    const baseRs = groups.get([e, c, bucket, hash, window, baseArm, stage].join('|')) ?? [];
    const warm = rs.filter(r => r.ok && !r.cold);
    const cold = rs.filter(r => r.cold);
    const m = warmMem(rs);
    const b = warmMem(baseRs);
    out.push(
      `| ${e} | ${c} | ${bucket}:${hash!.slice(0, 8)} | ${window} | ${variant}${rs[0]!.statement ? ` ${rs[0]!.statement}` : stage !== '0' ? `#${stage}` : ''} | ${warm.length ? m.toFixed(1) : '—'} (${warm.length}) | ${warm.length && b ? `×${(m / b).toFixed(2)}` : '—'} | ${warm.length ? (median(warm.map(r => r.metrics!.readBytes)) / 1e6).toFixed(1) : '—'} | ${warm.length ? Math.round(median(warm.map(r => r.metrics!.durationMs))) : '—'} | ${cold.map(r => (r.ok ? Math.round(r.metrics!.durationMs) : `✗${r.errorCategory}`)).join(', ') || '—'} | ${rs.filter(r => !r.ok).length || ''} |`,
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/** Other bench processes against the replica (aggregate track or ours); prints counts only. */
function otherBenchProcesses(): string[] {
  try {
    const ps = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    return ps
      .split('\n')
      .filter(l => /^\s*\d+ node .*bench\/aggregate-traces\/(run|floor|lab|retries)\.ts/.test(l))
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
      exp: { type: 'string', default: 'QX' },
      legacy: { type: 'string' },
      cases: { type: 'string', default: 'T0' },
      targets: { type: 'string', default: 'small' },
      windows: { type: 'string', default: '1d,30d' },
      reps: { type: 'string', default: '5' },
      cold: { type: 'boolean', default: false },
      'cold-reps': { type: 'string', default: '1' },
      'allow-shared': { type: 'boolean', default: false },
    },
  });
  const command = positionals[0];
  mkdirSync(RESULTS_DIR, { recursive: true });
  if (command === 'summary') {
    console.log(summarize(readRecords<ExpRecord>(EXPERIMENTS_FILE), values.exp === 'QX' ? undefined : values.exp));
    return;
  }
  if (!['ship', 'equiv', 'census'].includes(command ?? '')) throw new Error(`Unknown command ${command}`);
  const others = otherBenchProcesses();
  if (others.length && !values['allow-shared']) {
    log(
      `note: ${others.length} other bench process(es) running against the replica; latency comparisons stay within our own ABAB pairs`,
    );
  }
  const selection = loadSelection();
  if (!selection) throw new Error('No selection; run the aggregate profile first');
  const sidecar = loadSidecar();
  const pre = readJson<Preflight>(files(RESULTS_DIR).preflight);
  const client = connect(loadCredentials(), pre.database);
  const runId = `${values.exp}-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)}`;
  const ctx: Ctx = {
    client,
    runId,
    exp: values.exp!,
    anchorTo: selection.anchorTo,
    sidecar,
    lastEnd: 0,
    consecutiveErrors: 0,
    overloads: 0,
  };
  const targets = resolveTargets(selection, values.targets!);
  const windows = values.windows!.split(',');
  const cases = values.cases!.split(',');
  let impls: Impls | undefined;
  if (command !== 'census') {
    if (!values.legacy) throw new Error('--legacy <old trace-query module> is required');
    const legacy = (await import(resolve(values.legacy))) as { queryTraces?: QueryTracesFn };
    if (typeof legacy.queryTraces !== 'function') throw new Error('--legacy module has no queryTraces export');
    impls = { old: legacy.queryTraces, new: queryTraces };
  }
  log(
    `${command} ${values.exp} run ${runId}: cases [${cases.join(', ')}] targets [${targets.map(t => `${t.bucket}:${t.hash}`).join(', ')}] windows [${windows.join(', ')}]`,
  );
  try {
    if (command === 'census') await census(ctx, targets, windows);
    if (command === 'ship')
      await ship(
        ctx,
        impls!,
        cases,
        targets,
        windows,
        Number(values.reps),
        values.cold ? Number(values['cold-reps']) : 0,
      );
    if (command === 'equiv') await equiv(ctx, impls!, cases, targets, windows);
  } finally {
    await client.close();
  }
  log('done');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

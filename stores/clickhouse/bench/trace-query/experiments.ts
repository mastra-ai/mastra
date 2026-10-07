/**
 * Memory experiments for `queryTraces()` (EXPERIMENTS.md). Read-only, sequential, paced, Tier 1 limits; records
 * go to `results/experiments.jsonl` as bucket + project hash only.
 *
 *   tsx bench/trace-query/experiments.ts census  --targets small,p99,p99:62b01951,largest --windows 1d,30d
 *   tsx bench/trace-query/experiments.ts ab      --exp QX01 --variants pf8,nopf --cases T0,P0 --targets small,p99
 *                                                [--windows 1d,30d] [--reps 5] [--cold [--cold-reps 1]]
 *   tsx bench/trace-query/experiments.ts equiv   --exp QX03 --variants nh --cases T0,K2 --targets ... [--windows]
 *   tsx bench/trace-query/experiments.ts explain --variants topn --cases T0 --targets p99 --windows 30d
 *   tsx bench/trace-query/experiments.ts summary [--exp QX01]
 *
 * Targets: a bucket name (its representative project) or `bucket:hashprefix`. `ab` runs base and every variant
 * interleaved per rep (ABAB…, order reversed on odd reps), so replica drift hits every arm alike. `equiv` compares
 * order-sensitive and order-free hashes of base vs variant results on the server; only counts and hashes return.
 * Every command checks first that no other bench process is running against the replica (`--allow-shared` skips).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

import type { ClickHouseSettings } from '@clickhouse/client';

import { isLimitCategory, isOverload, TIERS } from '../shared/client';
import type { BenchClient, QueryOutcome } from '../shared/client';
import { installOutputRedaction, loadCredentials, registerSensitive } from '../shared/env';
import { fromSummary } from '../shared/metrics';
import type { QueryMetrics } from '../shared/metrics';
import { loadSelection } from '../shared/profile';
import type { SelectedProject, Selection } from '../shared/profile';
import { median } from '../shared/report-kit';
import { connect, log, readJson, readRecords } from '../shared/runner';
import type { Preflight } from '../shared/runner';
import { RewriteError } from '../shared/scope';
import { caseById, compileCase, DELTA_HEAD_SQL, timeRangeFor, WINDOWS } from './cases';
import type { CursorAt } from './cases';
import { literalsFor, loadSidecar } from './discover';
import type { Sidecar } from './discover';
import { files, RESULTS_DIR } from './run';
import { deltaHead, keyOnly, KeyQueryFailed, traceCursorRows, walkCursor } from './stages';
import type { KeyRunner, Statement } from './stages';
import { planVariant, resultColumns } from './variants';

export const EXPERIMENTS_FILE = `${RESULTS_DIR}/experiments.jsonl`;
const PAUSE_MS = 3_000;
const OVERLOAD_PAUSE_MS = 60_000;
const HOP = 1000;
const tier = TIERS[1];

export interface ExpRecord {
  runId: string;
  exp: string;
  kind: 'ab' | 'equiv' | 'census' | 'explain';
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
  /** equiv: aggregate-only comparison; census/explain: aggregate counts. */
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
  options: { cold?: boolean; settings?: ClickHouseSettings; parse?: boolean } = {},
): Promise<QueryOutcome<Row>> {
  for (let attempt = 0; ; attempt++) {
    const wait = ctx.lastEnd + PAUSE_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const run = {
      tier,
      logComment: ['aqa-bench', ctx.runId, ctx.exp, step].join(':'),
      cold: options.cold,
      sharedSnapshot: statement.sharedSnapshot,
      settings: options.settings,
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

/** The project-scoped compiled statement for a case, with the cursor/watermark the benchmark used. */
async function baseStatement(
  ctx: Ctx,
  caseId: string,
  project: SelectedProject,
  windowId: keyof typeof WINDOWS,
): Promise<Statement | string> {
  const def = caseById(caseId);
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
      head = await deltaHead(runKey, { query: DELTA_HEAD_SQL, query_params: {} });
      cursor = { kind: 'delta', cursorId: '0', traceId: '' };
      if (def.depth) return 'delta depth not supported in experiments';
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
  return compileCase(def, 'base', literals, timeRange, project, { cursor, deltaHead: head }).compiled;
}

// ---------------------------------------------------------------------------
// ab
// ---------------------------------------------------------------------------

async function runArm(
  ctx: Ctx,
  spec: string,
  base: Statement,
  meta: Omit<ExpRecord, 'runId' | 'exp' | 'kind' | 'ok' | 'ts'>,
): Promise<void> {
  const plan = planVariant(spec, base);
  const record = (outcome: QueryOutcome<unknown>, stage: number) => {
    const r: ExpRecord = {
      runId: ctx.runId,
      exp: ctx.exp,
      kind: 'ab',
      ...meta,
      variant: spec,
      stage,
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
      `${meta.caseId} ${meta.bucket}:${meta.hash} ${meta.window} rep${meta.rep}${meta.cold ? ' cold' : ''} ${spec}${stage ? `#${stage}` : ''}: ` +
        (outcome.ok
          ? `${((m.memoryBytes ?? 0) / 2 ** 20).toFixed(1)} MiB, ${(m.readBytes / 1e6).toFixed(1)} MB, ${Math.round(m.durationMs)} ms`
          : `FAILED ${outcome.errorCategory} (code ${outcome.errorCode})`),
    );
  };
  const step = `${meta.caseId}:${spec}:${meta.window}:${meta.bucket}:${meta.hash}:${meta.rep}`;
  const first = await exec(ctx, plan.statements[0]!, step, { cold: meta.cold, settings: plan.settings });
  record(first, 0);
  if (!plan.hydrate || !first.ok) return;
  const keys = await exec<{ s: string; t: string; d: string }>(
    ctx,
    keyOnly(plan.statements[0]!, 'toString(startedAt) AS s, traceId AS t, __dedupeKey AS d'),
    `${step}:keys`,
    { parse: true },
  );
  if (!keys.ok || !keys.rows?.length) return;
  registerSensitive(keys.rows.flatMap(k => [k.t, k.d]));
  const second = await exec(ctx, plan.hydrate(keys.rows.map(k => [k.s, k.t, k.d])), `${step}:hydrate`, {
    cold: meta.cold,
    settings: plan.hydrateSettings,
  });
  record(second, 1);
}

async function ab(
  ctx: Ctx,
  specs: string[],
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
        const base = await baseStatement(ctx, caseId, project, windowId as keyof typeof WINDOWS);
        const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
        if (typeof base === 'string') {
          append({
            runId: ctx.runId,
            exp: ctx.exp,
            kind: 'ab',
            ...meta,
            ok: false,
            note: `skip: ${base}`,
            ts: new Date().toISOString(),
          });
          log(`skip ${caseId} ${project.bucket} ${windowId}: ${base}`);
          continue;
        }
        const arms = ['base', ...specs].filter(spec => {
          try {
            planVariant(spec, base);
            return true;
          } catch (error) {
            if (!(error instanceof RewriteError)) throw error;
            append({
              runId: ctx.runId,
              exp: ctx.exp,
              kind: 'ab',
              ...meta,
              variant: spec,
              ok: false,
              note: `n/a: ${error.message}`,
              ts: new Date().toISOString(),
            });
            log(`n/a ${caseId} ${spec}: ${error.message}`);
            return false;
          }
        });
        if (arms.length < 2) continue;
        const start = -coldReps;
        for (let rep = start; rep < reps; rep++) {
          const order = (rep + 2) % 2 === 0 ? arms : [...arms].reverse();
          for (const spec of order) await runArm(ctx, spec, base, { ...meta, rep, cold: rep < 0 });
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

interface HashRow {
  n: string;
  unordered: string;
  ordered: string;
}

async function equiv(ctx: Ctx, specs: string[], cases: string[], targets: SelectedProject[], windows: string[]) {
  for (const project of targets) {
    for (const windowId of windows) {
      for (const caseId of cases) {
        const base = await baseStatement(ctx, caseId, project, windowId as keyof typeof WINDOWS);
        const meta = { caseId, window: windowId, bucket: project.bucket, hash: project.hash };
        if (typeof base === 'string') {
          log(`skip ${caseId} ${project.bucket} ${windowId}: ${base}`);
          continue;
        }
        const all = resultColumns(base.query);
        const hashOf = async (
          statement: Statement,
          columns: string[],
          label: string,
          settings?: ClickHouseSettings,
        ) => {
          const out = await exec<HashRow>(ctx, hashStatement(statement, columns), `equiv:${caseId}:${label}`, {
            parse: true,
            settings,
          });
          return out.ok ? out.rows![0]! : { error: out.errorCategory ?? 'other' };
        };
        // Base twice: the control for the method itself (ordered hash must be stable).
        const baseHash = await hashOf(base, all, 'base');
        const control = await hashOf(base, all, 'base2');
        for (const spec of specs) {
          let plan;
          try {
            plan = planVariant(spec, base);
          } catch (error) {
            if (error instanceof RewriteError) {
              log(`n/a ${caseId} ${spec}: ${error.message}`);
              continue;
            }
            throw error;
          }
          // Two-stage variants: stage 1 must equal base minus the blob columns.
          const narrow = plan.hydrate ? all.filter(c => c !== 'metadata' && c !== 'input') : all;
          const left = plan.hydrate ? await hashOf(base, narrow, 'base-narrow') : baseHash;
          const right = await hashOf(plan.statements[0]!, narrow, spec, plan.settings);
          const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);
          const data = {
            rows: 'n' in left ? Number(left.n) : null,
            // Two failures with the same category are not a match: the comparison didn't run.
            match: 'n' in left && 'n' in right && same(left, right),
            setMatch: 'n' in left && 'n' in right ? left.unordered === right.unordered && left.n === right.n : false,
            controlStable: same(baseHash, control),
            errors: ['error' in left ? left.error : null, 'error' in right ? right.error : null].filter(Boolean),
          };
          append({
            runId: ctx.runId,
            exp: ctx.exp,
            kind: 'equiv',
            ...meta,
            variant: spec,
            ok: data.match,
            data,
            ts: new Date().toISOString(),
          });
          log(`equiv ${caseId} ${project.bucket}:${project.hash} ${windowId} ${spec}: ${JSON.stringify(data)}`);
        }
      }
    }
  }
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
// explain (plan shape only: read type, parts/granules; no conditions or literals)
// ---------------------------------------------------------------------------

const EXPLAIN_KEEP =
  /ReadFromMergeTree|ReadType|Parts:|Granules:|Sorting|LimitBy|Limit \(|Expression \(Before ORDER BY|FinishSorting|PartialSorting|MergeSorting/;

async function explain(ctx: Ctx, specs: string[], cases: string[], targets: SelectedProject[], windows: string[]) {
  for (const project of targets) {
    for (const windowId of windows) {
      for (const caseId of cases) {
        const base = await baseStatement(ctx, caseId, project, windowId as keyof typeof WINDOWS);
        if (typeof base === 'string') continue;
        for (const spec of ['base', ...specs]) {
          const plan = planVariant(spec, base);
          const statement = plan.statements[0]!;
          const out = await exec<{ explain: string }>(
            ctx,
            { ...statement, query: `EXPLAIN PLAN indexes = 1, actions = 1 ${statement.query}` },
            `explain:${caseId}:${spec}`,
            { parse: true, settings: plan.settings },
          );
          const lines = out.ok
            ? out
                .rows!.map(r => r.explain)
                .filter(l => EXPLAIN_KEEP.test(l))
                .map(l => l.replace(/\s+$/, ''))
            : [];
          append({
            runId: ctx.runId,
            exp: ctx.exp,
            kind: 'explain',
            caseId,
            variant: spec,
            window: windowId,
            bucket: project.bucket,
            hash: project.hash,
            ok: out.ok,
            data: { lines },
            ts: new Date().toISOString(),
          });
          log(`explain ${caseId} ${spec} ${project.bucket} ${windowId}:\n${lines.join('\n')}`);
        }
      }
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
    const baseRs = groups.get([e, c, bucket, hash, window, 'base', 0].join('|')) ?? [];
    const warm = rs.filter(r => r.ok && !r.cold);
    const cold = rs.filter(r => r.cold);
    const m = warmMem(rs);
    const b = warmMem(baseRs);
    out.push(
      `| ${e} | ${c} | ${bucket}:${hash!.slice(0, 8)} | ${window} | ${variant}${stage !== '0' ? `#${stage}` : ''} | ${warm.length ? m.toFixed(1) : '—'} (${warm.length}) | ${warm.length && b ? `×${(m / b).toFixed(2)}` : '—'} | ${warm.length ? (median(warm.map(r => r.metrics!.readBytes)) / 1e6).toFixed(1) : '—'} | ${warm.length ? Math.round(median(warm.map(r => r.metrics!.durationMs))) : '—'} | ${cold.map(r => (r.ok ? Math.round(r.metrics!.durationMs) : `✗${r.errorCategory}`)).join(', ') || '—'} | ${rs.filter(r => !r.ok).length || ''} |`,
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
      variants: { type: 'string', default: '' },
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
  if (!['ab', 'equiv', 'census', 'explain'].includes(command ?? '')) throw new Error(`Unknown command ${command}`);
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
  const specs = values.variants ? values.variants.split(',') : [];
  const cases = values.cases!.split(',');
  log(
    `${command} ${values.exp} run ${runId}: variants [${specs.join(', ')}] cases [${cases.join(', ')}] targets [${targets.map(t => `${t.bucket}:${t.hash}`).join(', ')}] windows [${windows.join(', ')}]`,
  );
  try {
    if (command === 'census') await census(ctx, targets, windows);
    if (command === 'ab')
      await ab(ctx, specs, cases, targets, windows, Number(values.reps), values.cold ? Number(values['cold-reps']) : 0);
    if (command === 'equiv') await equiv(ctx, specs, cases, targets, windows);
    if (command === 'explain') await explain(ctx, specs, cases, targets, windows);
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

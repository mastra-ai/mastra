/**
 * Trace-query benchmark runner.
 *
 *   tsx bench/trace-query/run.ts preflight [--accept-readonly-0]   metadata + capacity check
 *   tsx bench/trace-query/run.ts discover                          sidecar literals (aggregate-only)
 *   tsx bench/trace-query/run.ts probe [--levels 4,2] [--buckets …] [--windows …] [--blocks N]
 *                                                                   concurrency A/B proof → concurrency.json
 *   tsx bench/trace-query/run.ts run --buckets small,mid [--windows 1d] [--cases T0,T7]
 *                                    [--concurrency N] [--gate-b-approved] [--dry-run]
 *   tsx bench/trace-query/run.ts report
 *
 * Same safety model as the aggregate suite (../shared): host guard, read-only allowlist, Tier
 * limits on every query, results counted not parsed, redacted output. Concurrency goes through
 * ../shared/pool.ts and must be justified by the probe before any counted result is recorded.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { isLimitCategory, TIERS } from '../shared/client';
import type { BenchClient, ErrorCategory, QueryOutcome, Tier } from '../shared/client';
import { installOutputRedaction, loadCredentials } from '../shared/env';
import { collectMetrics } from '../shared/metrics';
import type { QueryLogSource, QueryMetrics } from '../shared/metrics';
import { Pool, PoolAborted } from '../shared/pool';
import type { PoolUnit, Slot } from '../shared/pool';
import { BUCKETS, loadSelection } from '../shared/profile';
import type { Bucket, SelectedProject, Selection } from '../shared/profile';
import { median, quantile } from '../shared/report-kit';
import {
  connect,
  DEFAULT_REQUIRED_COLUMNS,
  DEFAULT_TABLES,
  list,
  log,
  logPreflight,
  PAUSE_MS,
  preflight,
  preflightReadonly,
  readJson,
  readRecords,
  skippedByEscalation,
  WINDOW_ORDER,
  windowStage,
  writeJson,
} from '../shared/runner';
import type { LimitHit, Preflight, WindowDef, WindowStage } from '../shared/runner';
import { caseById, CASES, compileCase, DELTA_HEAD_SQL, timeRangeFor, WINDOWS } from './cases';
import type { CaseDef, CursorAt, Stage, Variant } from './cases';
import { discoverSidecar, literalsFor, loadSidecar, publicSidecar, saveSidecar } from './discover';
import type { Sidecar } from './discover';
import {
  captureSpanHydration,
  deltaHead,
  KeyQueryFailed,
  pageKeys,
  payloadStatement,
  recentWatermark,
  scopedSpanHydration,
  spanCursor,
  spanSelectRows,
  threadCursorRows,
  traceCursorRows,
  walkCursor,
} from './stages';
import type { KeyRunner, PageKey, SpanHydration, Statement } from './stages';

export const RESULTS_DIR = join(import.meta.dirname, 'results');
export const files = (dir = RESULTS_DIR) => ({
  runs: join(dir, 'runs.jsonl'),
  probe: join(dir, 'probe.jsonl'),
  skips: join(dir, 'skips.jsonl'),
  superseded: join(dir, 'superseded.json'),
  concurrency: join(dir, 'concurrency.json'),
  preflight: join(dir, 'preflight.json'),
  capacity: join(dir, 'capacity.json'),
  literals: join(dir, 'literals.json'),
});

export const DELTA_TABLE = 'mastra_trace_roots_delta';
export const TABLES = [...DEFAULT_TABLES, DELTA_TABLE];
export const REQUIRED_COLUMNS: Record<string, string[]> = {
  ...DEFAULT_REQUIRED_COLUMNS,
  mastra_trace_roots: [...DEFAULT_REQUIRED_COLUMNS.mastra_trace_roots!, 'resourceId', 'tags', 'error', 'input', 'name'],
  mastra_span_events: [
    ...DEFAULT_REQUIRED_COLUMNS.mastra_span_events!,
    'resourceId',
    'startedAt',
    'attributes',
    'error',
    'input',
    'output',
    'entityType',
    'entityName',
  ],
  mastra_metric_events: [
    'organizationId',
    'projectId',
    'resourceId',
    'traceId',
    'spanId',
    'metricId',
    'name',
    'timestamp',
    'estimatedCost',
    'costUnit',
    'costMetadata',
  ],
  mastra_feedback_events: [
    'organizationId',
    'projectId',
    'traceId',
    'feedbackId',
    'feedbackType',
    'writeVersion',
    'timestamp',
  ],
};

export const HOP = 1_000;
export const START_GAP_MS = 250;
export const OVERLOAD_PAUSE_MS = 60_000;
export const DEFAULT_CONCURRENCY = 4;
export const PROBE_CASES = ['T0', 'T7', 'P0', 'TH0', 'S0', 'OF0', 'V1', 'V6'];
export const PROBE_BUCKETS: Bucket[] = ['small', 'mid', 'p90'];
export const PROBE_WINDOWS: WindowStage[] = ['1d', '7d'];
export const SENTINEL_CASES = ['T0', 'T7', 'S0'];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type Mode = 'run' | 'sentinel' | 'probe';

export interface TqRecord {
  runId: string;
  key: string;
  mode: Mode;
  /** Identifies one execution of a phase; superseded phase runs are excluded from the report. */
  phaseRun: string;
  caseId: string;
  api: CaseDef['api'];
  kind: CaseDef['kind'];
  variant: Variant;
  stage: Stage;
  window: string;
  windowMs: number;
  bucket: Bucket;
  hash: string;
  traces30d: number;
  rep: number;
  cold: boolean;
  tier: 1 | 2 | 3;
  anchorTo: string;
  ts: string;
  ok: boolean;
  errorCode?: string;
  errorCategory?: ErrorCategory;
  wallMs: number;
  streamedRows: number;
  metrics: QueryMetrics;
  /** Concurrency limit in force at query start (1 for exclusive queries). */
  concurrency: number;
  /** Queries in flight at query start, including this one. */
  inFlight: number;
  exclusive: boolean;
  sentinel: boolean;
  calibration: boolean;
  retried: boolean;
  arm?: 'A' | 'B';
  probeLevel?: number;
}

export interface SkipRecord {
  runId: string;
  key: string;
  mode: Mode;
  caseId: string;
  variant: Variant;
  window: string;
  bucket: Bucket;
  hash: string;
  reason: string;
}

export function recordKey(
  mode: Mode,
  caseId: string,
  variant: string,
  stage: Stage,
  window: string,
  hash: string,
  extra = '',
): string {
  return [mode, caseId, variant, stage, window, hash, extra].filter(Boolean).join('|');
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** Gate B: p99 at 30d, largest beyond 1d, and every high-cardinality case on p99/largest. */
export function needsGateB(def: CaseDef, window: WindowDef, bucket: Bucket): boolean {
  const stage = windowStage(window);
  if (bucket === 'p99' && stage === '30d') return true;
  if (bucket === 'largest' && stage !== '1d') return true;
  return def.hc && (bucket === 'p99' || bucket === 'largest');
}

export interface Planned {
  def: CaseDef;
  variant: Variant;
  window: WindowDef;
  project: SelectedProject;
  phase: string;
}

export interface RunFilter {
  buckets: Bucket[];
  windows: WindowStage[];
  cases?: string[];
  gateBApproved: boolean;
  deltaAvailable: boolean;
  /** Relations whose table is missing or older than the store's schema on this replica. */
  unavailable?: string[];
}

export function phaseOf(bucket: Bucket, stage: WindowStage): string {
  return `${bucket}:${stage}`;
}

/** Phases in smallest-first order: bucket, then window. */
export function phaseOrder(filter: Pick<RunFilter, 'buckets' | 'windows'>): string[] {
  return BUCKETS.filter(b => filter.buckets.includes(b)).flatMap(b =>
    WINDOW_ORDER.filter(w => filter.windows.includes(w)).map(w => phaseOf(b, w)),
  );
}

export function planUnits(selection: Pick<Selection, 'projects'>, filter: RunFilter): Planned[] {
  const defs = [...CASES]
    .filter(d => !filter.cases || filter.cases.includes(d.id))
    .filter(d => !d.delta || filter.deltaAvailable)
    .filter(d => !d.relations.some(r => filter.unavailable?.includes(r)))
    .sort((a, b) => a.cost - b.cost);
  const planned: Planned[] = [];
  for (const bucket of BUCKETS) {
    if (!filter.buckets.includes(bucket)) continue;
    const projects = selection.projects.filter(p => p.bucket === bucket);
    for (const stage of WINDOW_ORDER) {
      if (!filter.windows.includes(stage)) continue;
      for (const def of defs) {
        for (const window of def.windows.filter(w => windowStage(w) === stage)) {
          if (needsGateB(def, window, bucket) && !filter.gateBApproved) continue;
          for (const project of projects) {
            if (!def.core && !project.representative) continue;
            for (const variant of def.variants)
              planned.push({ def, variant, window, project, phase: phaseOf(bucket, stage) });
          }
        }
      }
    }
  }
  return planned;
}

function repsFor(bucket: Bucket): number {
  return bucket === 'p99' || bucket === 'largest' ? 4 : 6;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface TqContext {
  client: BenchClient;
  pool: Pool;
  queryLog: QueryLogSource;
  runId: string;
  tier: Tier;
  anchorTo: string;
  sidecar: Sidecar | undefined;
  resultsDir: string;
  /** Overrides the per-bucket repetition count (local smoke run only). */
  reps?: number;
  /** Print redacted error messages (local smoke run only). */
  verbose?: boolean;
  /** Builds the probe arms' pools (the local smoke run drops pacing). */
  newPool?: (concurrency: number) => Pool;
}

export const newPool = (concurrency: number) =>
  new Pool({ concurrency, pauseMs: PAUSE_MS, startGapMs: START_GAP_MS, overloadPauseMs: OVERLOAD_PAUSE_MS, log });

export interface UnitOptions {
  mode: Mode;
  phaseRun: string;
  /** Every query runs with nothing else in flight (sentinels, probe arm A). */
  exclusive?: boolean;
  /** Which cold reps run alone: the largest bucket's (always, in counted runs) or every bucket's (probe verdict). */
  coldAlone?: 'largest' | 'all';
  keyExtra?: string;
  arm?: 'A' | 'B';
  probeLevel?: number;
  done?: Set<string>;
}

export interface UnitResult {
  hits: LimitHit[];
  records: TqRecord[];
  skipped?: string;
}

function comment(ctx: TqContext, ...parts: Array<string | number>): string {
  return ['aqa-bench', ctx.runId, ...parts].join(':');
}

function appendJsonl(file: string, value: unknown): void {
  appendFileSync(file, `${JSON.stringify(value)}\n`);
}

function label(def: CaseDef, variant: Variant, stage: Stage): string {
  return `${def.id}${variant === 'base' ? '' : `-${variant}`}${stage === 'main' ? '' : `:${stage}`}`;
}

/** Runs one scheduling unit (case × variant × window × project): stages and reps in order, in one slot. */
export async function runUnit(ctx: TqContext, unit: Planned, slot: Slot, options: UnitOptions): Promise<UnitResult> {
  const { def, variant, window, project } = unit;
  const f = files(ctx.resultsDir);
  const result: UnitResult = { hits: [], records: [] };
  const skip = (reason: string): UnitResult => {
    const record: SkipRecord = {
      runId: ctx.runId,
      key: recordKey(options.mode, def.id, variant, 'main', window.id, project.hash, options.keyExtra),
      mode: options.mode,
      caseId: def.id,
      variant,
      window: window.id,
      bucket: project.bucket,
      hash: project.hash,
      reason,
    };
    appendJsonl(f.skips, record);
    log(`skip ${def.id}/${variant}/${window.id} on ${project.bucket}:${project.hash} (${reason})`);
    return { ...result, skipped: reason };
  };

  const literals = literalsFor(project, ctx.sidecar);
  const missing = (def.needs ?? []).filter(k => literals[k] === null);
  if (missing.length) return skip(`literal not found: ${missing.join(', ')}`);

  const timeRange = timeRangeFor(window, new Date(ctx.anchorTo));
  const exclusive = options.exclusive === true;
  const runKey: KeyRunner = async <Row>(statement: Statement, step: string) =>
    (
      await ctx.pool.query<Row>(
        slot,
        () =>
          ctx.client.rows<Row>(statement.query, statement.query_params, {
            tier: ctx.tier,
            logComment: comment(ctx, def.id, step, window.id, project.bucket, project.hash),
            sharedSnapshot: statement.sharedSnapshot,
          }),
        { exclusive },
      )
    ).outcome;

  let cursor: CursorAt | undefined;
  let head: { cursorId: string; traceId: string } | undefined;
  try {
    if (def.api === 'delta') {
      head = await deltaHead(runKey, { query: DELTA_HEAD_SQL, query_params: {} });
      if (def.depth) {
        const recent = await recentWatermark(runKey, def.depth);
        if (!recent) return skip(`delta index has fewer than ${def.depth} rows`);
        cursor = { kind: 'delta', ...recent };
      } else {
        cursor = { kind: 'delta', cursorId: '0', traceId: '' };
      }
    } else if (def.depth) {
      cursor = await walkCursor(def.depth, HOP, async at => {
        const hop = compileCase(def, 'base', literals, timeRange, project, { cursor: at, limit: HOP });
        if (hop.plan.api === 'traces')
          return traceCursorRows(runKey, hop.compiled, hop.plan.plan.orderBy.field as 'startedAt' | 'endedAt');
        if (hop.plan.api === 'threads') return threadCursorRows(runKey, hop.compiled);
        if (hop.plan.api === 'spans') {
          const field = hop.plan.plan.orderBy.field;
          return (await spanSelectRows(runKey, hop.compiled)).map(r => spanCursor(r, field));
        }
        throw new Error(`Case ${def.id}: depth is not supported for ${hop.plan.api}`);
      });
      if (!cursor) return skip(`fewer than ${def.depth} rows`);
    }
  } catch (error) {
    if (error instanceof KeyQueryFailed) return skip(error.message);
    throw error;
  }

  const { plan, compiled } = compileCase(def, variant, literals, timeRange, project, { cursor, deltaHead: head });
  let keys: PageKey[] | undefined;
  let hydration: SpanHydration | undefined | null;
  let scopedHydration: SpanHydration | undefined;

  for (const stage of def.stages) {
    const key = recordKey(options.mode, def.id, variant, stage, window.id, project.hash, options.keyExtra);
    if (options.done?.has(key)) continue;
    let statement: Statement = compiled;
    try {
      if (stage === 'payload' || stage === 'payload-scoped') {
        keys ??= await pageKeys(runKey, compiled);
        if (keys.length === 0) {
          skip(`${stage}: empty page`);
          continue;
        }
        statement = payloadStatement(keys, project, stage === 'payload-scoped');
      } else if (stage.startsWith('span-')) {
        if (plan.api !== 'spans') throw new Error(`Case ${def.id}: span stage on ${plan.api}`);
        if (hydration === undefined) {
          const selected = await spanSelectRows(runKey, compiled);
          hydration = (await captureSpanHydration(plan.plan, selected)) ?? null;
        }
        if (hydration === null) {
          skip(`${stage}: empty page`);
          continue;
        }
        scopedHydration ??= scopedSpanHydration(hydration, project, timeRange.from);
        const source = stage.endsWith('-scoped') ? scopedHydration : hydration;
        statement = stage.startsWith('span-payload') ? source.payload : source.metrics;
      }
    } catch (error) {
      if (error instanceof KeyQueryFailed) {
        skip(`${stage}: ${error.message}`);
        continue;
      }
      throw error;
    }

    const name = label(def, variant, stage);
    for (let rep = 0; rep < (ctx.reps ?? repsFor(project.bucket)); rep++) {
      const cold = rep === 0;
      const alone =
        exclusive ||
        (cold && (options.coldAlone === 'all' || (options.coldAlone === 'largest' && project.bucket === 'largest')));
      const logComment = comment(ctx, options.mode, name, window.id, project.bucket, project.hash, rep);
      const tracked = await ctx.pool.query(
        slot,
        () =>
          ctx.client.discard(statement.query, statement.query_params, {
            tier: ctx.tier,
            logComment,
            cold,
            sharedSnapshot: statement.sharedSnapshot,
          }),
        { exclusive: alone },
      );
      const outcome = tracked.outcome as QueryOutcome;
      const metrics = await collectMetrics(ctx.client, ctx.queryLog, outcome, ctx.tier, `${logComment}:metrics`);
      const record: TqRecord = {
        runId: ctx.runId,
        key,
        mode: options.mode,
        phaseRun: options.phaseRun,
        caseId: def.id,
        api: def.api,
        kind: def.kind,
        variant,
        stage,
        window: window.id,
        windowMs: window.ms,
        bucket: project.bucket,
        hash: project.hash,
        traces30d: project.stats.traces30d,
        rep,
        cold,
        tier: ctx.tier.id,
        anchorTo: ctx.anchorTo,
        ts: new Date().toISOString(),
        ok: outcome.ok,
        errorCode: outcome.errorCode,
        errorCategory: outcome.errorCategory,
        wallMs: Math.round(outcome.wallMs),
        streamedRows: outcome.streamedRows,
        metrics,
        concurrency: tracked.concurrency,
        inFlight: tracked.inFlight,
        exclusive: alone,
        sentinel: options.mode === 'sentinel',
        calibration: options.mode !== 'run',
        retried: tracked.retried,
        ...(options.arm ? { arm: options.arm, probeLevel: options.probeLevel } : {}),
      };
      appendJsonl(options.mode === 'probe' ? f.probe : f.runs, record);
      result.records.push(record);
      const status = outcome.ok
        ? `${Math.round(metrics.durationMs)} ms, ${(metrics.readBytes / 1e6).toFixed(1)} MB read, ${((metrics.memoryBytes ?? 0) / 2 ** 20).toFixed(0)} MiB`
        : `FAILED ${outcome.errorCategory} (code ${outcome.errorCode ?? '?'})${ctx.verbose ? `: ${outcome.errorMessage?.trim()}` : ''}`;
      log(
        `${options.mode === 'run' ? '' : `[${options.mode}${options.arm ?? ''}] `}${project.bucket}:${project.hash} ${name} ${window.id} rep${rep}${cold ? ' cold' : ''} c${tracked.concurrency}/f${tracked.inFlight}: ${status}`,
      );
      if (outcome.ok) continue;
      if (outcome.errorCategory && isLimitCategory(outcome.errorCategory)) {
        // Same rule as OBS-539: only warm limit hits drive escalation; keep measuring after a cold one.
        if (cold) continue;
        result.hits.push({ bucket: project.bucket, windowMs: window.ms });
      }
      break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sentinels and the concurrency proof (pure comparisons, unit-tested)
// ---------------------------------------------------------------------------

const cellKey = (r: TqRecord) => [r.caseId, r.variant, r.stage, r.window, r.hash].join('|');
const ratio = (a: number, b: number) => (b > 0 ? a / b : a > 0 ? Infinity : 1);
const warmOk = (rs: TqRecord[]) => rs.filter(r => r.ok && !r.cold);

export interface SentinelResult {
  cells: Array<{ cell: string; memoryRatio: number; latencyRatio: number; liveReadSet: boolean }>;
  memoryDrift: boolean;
  latencyRatio: number;
}

/** Compares a phase's concurrent records with its sequential sentinel records (warm reps). */
/** See ProbeCell.liveReadSet. */
const isLiveReadSet = (r: TqRecord) => r.api === 'spans' && r.stage === 'main';

export function compareSentinels(concurrent: TqRecord[], sentinel: TqRecord[]): SentinelResult {
  const cells: SentinelResult['cells'] = [];
  for (const [cell, seq] of groupBy(warmOk(sentinel), cellKey)) {
    const con = warmOk(concurrent).filter(r => cellKey(r) === cell);
    if (con.length === 0 || seq.length === 0) continue;
    cells.push({
      cell,
      memoryRatio: ratio(
        median(con.map(r => r.metrics.memoryBytes ?? 0)),
        median(seq.map(r => r.metrics.memoryBytes ?? 0)),
      ),
      latencyRatio: ratio(median(con.map(r => r.metrics.durationMs)), median(seq.map(r => r.metrics.durationMs))),
      liveReadSet: isLiveReadSet(seq[0]!),
    });
  }
  return {
    cells,
    memoryDrift: cells.some(c => !c.liveReadSet && Math.abs(c.memoryRatio - 1) > 0.1),
    latencyRatio: cells.length ? median(cells.map(c => c.latencyRatio)) : 1,
  };
}

export interface ProbeCell {
  cell: string;
  memory: number;
  readRows: number;
  readBytes: number;
  warmMedian: number;
  warmP90: number;
  cold: number | null;
  /**
   * The read set depends on wall-clock time, not on the query's neighbours: the querySpans() select
   * bounds endedAt from below only, so it also scans spans ingested since the window ended. Memory follows
   * that input, so rows, bytes and per-cell memory are reported for these cells but not compared.
   */
  liveReadSet: boolean;
  /** Cold rep hit a limit concurrently but succeeded sequentially (excluded from the ratio, so counted here). */
  coldFailedOnlyConcurrent: boolean;
}

export interface ProbeVerdict {
  level: number;
  cells: ProbeCell[];
  overloads: number;
  memoryMedian: number;
  warmMedian: number;
  warmP90: number;
  coldMedian: number;
  checks: Record<
    'memoryMedian' | 'memoryEvery' | 'rowsBytes' | 'warmMedian' | 'warmP90' | 'cold' | 'overload',
    boolean
  >;
  pass: boolean;
  /** Everything except cold latency passed: run concurrently, but cold reps alone. */
  passWithColdAlone: boolean;
}

export const PROBE_CRITERIA = {
  memoryMedian: 0.05,
  memoryEvery: 0.1,
  rowsBytes: 0.01,
  warmMedian: 1.1,
  warmP90: 1.2,
  cold: 1.15,
};

/** B/A ratios per case × stage × project × window, judged against the plan's pass criteria. */
export function evaluateProbe(records: TqRecord[], level: number): ProbeVerdict {
  const atLevel = records.filter(r => r.probeLevel === level);
  const a = atLevel.filter(r => r.arm === 'A');
  const b = atLevel.filter(r => r.arm === 'B');
  const cells: ProbeCell[] = [];
  for (const [cell, ra] of groupBy(a, cellKey)) {
    const rb = b.filter(r => cellKey(r) === cell);
    const wa = warmOk(ra);
    const wb = warmOk(rb);
    if (wa.length === 0 || wb.length === 0) continue;
    const m = (rs: TqRecord[], f: (r: TqRecord) => number) => median(rs.map(f));
    const ca = ra.find(r => r.cold && r.ok);
    const cb = rb.find(r => r.cold && r.ok);
    cells.push({
      cell,
      memory: ratio(
        m(wb, r => r.metrics.memoryBytes ?? 0),
        m(wa, r => r.metrics.memoryBytes ?? 0),
      ),
      readRows: ratio(
        m(wb, r => r.metrics.readRows),
        m(wa, r => r.metrics.readRows),
      ),
      readBytes: ratio(
        m(wb, r => r.metrics.readBytes),
        m(wa, r => r.metrics.readBytes),
      ),
      warmMedian: ratio(
        m(wb, r => r.metrics.durationMs),
        m(wa, r => r.metrics.durationMs),
      ),
      warmP90: ratio(
        quantile(
          wb.map(r => r.metrics.durationMs),
          0.9,
        ),
        quantile(
          wa.map(r => r.metrics.durationMs),
          0.9,
        ),
      ),
      cold: ca && cb ? ratio(cb.metrics.durationMs, ca.metrics.durationMs) : null,
      liveReadSet: isLiveReadSet(ra[0]!),
      coldFailedOnlyConcurrent: Boolean(ca) && rb.some(r => r.cold && !r.ok && isLimitCategory(r.errorCategory!)),
    });
  }
  const overloads = atLevel.filter(r => r.errorCategory === 'overload' || r.retried).length;
  const colds = cells.map(c => c.cold).filter((c): c is number => c !== null);
  const memoryMedian = cells.length ? median(cells.map(c => c.memory)) : 1;
  const warmMedian = cells.length ? median(cells.map(c => c.warmMedian)) : 1;
  const warmP90 = cells.length ? median(cells.map(c => c.warmP90)) : 1;
  const coldMedian = colds.length ? median(colds) : 1;
  const C = PROBE_CRITERIA;
  const checks = {
    memoryMedian: Math.abs(memoryMedian - 1) <= C.memoryMedian,
    memoryEvery: cells.filter(c => !c.liveReadSet).every(c => Math.abs(c.memory - 1) <= C.memoryEvery),
    rowsBytes: cells
      .filter(c => !c.liveReadSet)
      .every(c => Math.abs(c.readRows - 1) <= C.rowsBytes && Math.abs(c.readBytes - 1) <= C.rowsBytes),
    warmMedian: warmMedian <= C.warmMedian,
    warmP90: warmP90 <= C.warmP90,
    cold: coldMedian <= C.cold && !cells.some(c => c.coldFailedOnlyConcurrent),
    overload: overloads === 0,
  };
  const { cold, ...rest } = checks;
  const passWithColdAlone = cells.length > 0 && Object.values(rest).every(Boolean);
  return {
    level,
    cells,
    overloads,
    memoryMedian,
    warmMedian,
    warmP90,
    coldMedian,
    checks,
    pass: passWithColdAlone && cold,
    passWithColdAlone,
  };
}

function logVerdict(verdict: ProbeVerdict): void {
  log(
    `probe level ${verdict.level}: ${verdict.cells.length} cells; memory ×${verdict.memoryMedian.toFixed(3)}, warm ×${verdict.warmMedian.toFixed(2)} (p90 ×${verdict.warmP90.toFixed(2)}), cold ×${verdict.coldMedian.toFixed(2)}, overloads ${verdict.overloads} → ${verdict.pass ? 'PASS' : verdict.passWithColdAlone ? 'PASS (cold reps alone)' : 'FAIL'}`,
  );
  log(`  checks: ${JSON.stringify(verdict.checks)}`);
  const live = verdict.cells.filter(c => c.liveReadSet);
  if (live.length) log(`  live read set (not compared): rows ×${live.map(c => c.readRows.toFixed(2)).join(', ×')}`);
  const coldOnlyB = verdict.cells.filter(c => c.coldFailedOnlyConcurrent).length;
  if (coldOnlyB) log(`  cold limit hit only when concurrent: ${coldOnlyB} cell(s)`);
}

export interface ConcurrencyDecision {
  level: number;
  coldAlone: boolean;
  decidedAt: string;
  verdicts: Array<Omit<ProbeVerdict, 'cells'>>;
}

export function decide(verdicts: ProbeVerdict[]): ConcurrencyDecision {
  const strip = ({ cells: _cells, ...v }: ProbeVerdict) => v;
  const full = verdicts.find(v => v.pass);
  const partial = verdicts.find(v => v.passWithColdAlone);
  const chosen = full ?? partial;
  return {
    level: chosen?.level ?? 1,
    // Cold reps always run alone on the largest bucket; this extends it to every bucket.
    coldAlone: !full && Boolean(partial),
    decidedAt: new Date().toISOString(),
    verdicts: verdicts.map(strip),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface Capacity {
  checkedAt: string;
  cpuCores: number | null;
  memoryBytes: number | null;
  runningQueries: number | null;
  serverSettings: Record<string, string>;
  readable: Record<'asynchronous_metrics' | 'metrics' | 'server_settings', boolean>;
  /** Highest concurrency with cores ≥ 2 × concurrency × max_threads (null when cores are unknown). */
  maxConcurrency: number | null;
}

/** Metadata-only capacity check; every read is optional. */
export async function capacityCheck(client: BenchClient, runId: string, tier: Tier): Promise<Capacity> {
  const opts = (step: string) => ({ tier, logComment: `aqa-bench:${runId}:capacity:${step}` });
  const am = await client.rows<{ metric: string; value: number }>(
    "SELECT metric, value FROM system.asynchronous_metrics WHERE metric IN ('CGroupMaxCPU', 'CGroupMemoryTotal', 'OSMemoryTotal') UNION ALL SELECT 'perCpuMetrics', toFloat64(count()) FROM system.asynchronous_metrics WHERE match(metric, '^OSIdleTimeCPU[0-9]+$')",
    {},
    opts('asynchronous_metrics'),
  );
  const m = await client.rows<{ value: number }>(
    "SELECT value FROM system.metrics WHERE metric = 'Query'",
    {},
    opts('metrics'),
  );
  const ss = await client.rows<{ name: string; value: string }>(
    "SELECT name, value FROM system.server_settings WHERE name IN ('max_concurrent_queries', 'max_concurrent_select_queries', 'max_server_memory_usage', 'max_server_memory_usage_to_ram_ratio')",
    {},
    opts('server_settings'),
  );
  const metric = (name: string) => {
    const v = am.rows?.find(r => r.metric === name)?.value;
    return v !== undefined && Number(v) > 0 ? Number(v) : null;
  };
  // A cgroup CPU quota wins; otherwise count the per-CPU OS metrics.
  const cpuCores = metric('CGroupMaxCPU') ?? metric('perCpuMetrics');
  const memoryBytes = metric('CGroupMemoryTotal') ?? metric('OSMemoryTotal');
  return {
    checkedAt: new Date().toISOString(),
    cpuCores,
    memoryBytes,
    runningQueries: m.ok && m.rows?.[0] ? Number(m.rows[0].value) : null,
    serverSettings: Object.fromEntries((ss.rows ?? []).map(r => [r.name, String(r.value)])),
    readable: { asynchronous_metrics: am.ok, metrics: m.ok, server_settings: ss.ok },
    maxConcurrency: cpuCores === null ? null : Math.max(1, Math.min(8, Math.floor(cpuCores / (2 * tier.maxThreads)))),
  };
}

function representative(selection: Selection, bucket: Bucket): SelectedProject {
  const project = selection.projects.find(p => p.bucket === bucket && p.representative);
  if (!project) throw new Error(`No representative project for ${bucket}`);
  return project;
}

function phaseUnits(
  ctx: TqContext,
  planned: Planned[],
  options: UnitOptions,
  onResult: (r: UnitResult) => void,
): PoolUnit[] {
  return planned.map(unit => ({
    label: `${unit.def.id}/${unit.variant}/${unit.window.id}/${unit.project.hash}`,
    cost: unit.def.cost,
    run: async slot => onResult(await runUnit(ctx, unit, slot, options)),
  }));
}

function loadHits(records: TqRecord[]): Map<string, LimitHit[]> {
  const hits = new Map<string, LimitHit[]>();
  for (const r of records) {
    if (r.mode !== 'run' || r.ok || r.cold || !r.errorCategory || !isLimitCategory(r.errorCategory)) continue;
    const k = `${r.caseId}|${r.variant}`;
    hits.set(k, [...(hits.get(k) ?? []), { bucket: r.bucket, windowMs: r.windowMs }]);
  }
  return hits;
}

/** The counted run: phase by phase, with sentinels (and re-runs on drift) after each phase. */
export async function runPhases(
  ctx: TqContext,
  selection: Selection,
  filter: RunFilter,
  decision: ConcurrencyDecision,
): Promise<void> {
  const f = files(ctx.resultsDir);
  mkdirSync(ctx.resultsDir, { recursive: true });
  const superseded = new Set<string>(existsSync(f.superseded) ? readJson<string[]>(f.superseded) : []);
  const live = () => readRecords<TqRecord>(f.runs).filter(r => !superseded.has(r.phaseRun));
  const hits = loadHits(live());
  const planned = planUnits(selection, filter);
  let previousLatencyHigh = false;
  log(
    `${planned.length} units planned across ${phaseOrder(filter).length} phases at concurrency ${ctx.pool.concurrency}`,
  );

  for (const phase of phaseOrder(filter)) {
    for (let attempt = 1; ; attempt++) {
      const done = new Set(
        live()
          .filter(r => r.mode === 'run')
          .map(r => r.key),
      );
      const skipped = new Set(
        readRecords<SkipRecord>(f.skips)
          .filter(s => s.mode === 'run')
          .map(s => s.key),
      );
      const units = planned.filter(u => {
        if (u.phase !== phase) return false;
        if (skippedByEscalation(hits.get(`${u.def.id}|${u.variant}`) ?? [], u.project.bucket, u.window)) {
          log(
            `skip ${u.def.id}/${u.variant}/${u.window.id} on ${u.project.bucket}:${u.project.hash} (escalation rule)`,
          );
          return false;
        }
        const keys = u.def.stages.map(s => recordKey('run', u.def.id, u.variant, s, u.window.id, u.project.hash));
        if (skipped.has(recordKey('run', u.def.id, u.variant, 'main', u.window.id, u.project.hash))) return false;
        return keys.some(k => !done.has(k));
      });
      if (units.length === 0) break;
      const phaseRun = `${ctx.runId}:${phase}:${attempt}`;
      const concurrencyAtStart = ctx.pool.concurrency;
      const results: UnitResult[] = [];
      log(`phase ${phase} (attempt ${attempt}): ${units.length} units at concurrency ${concurrencyAtStart}`);
      await ctx.pool.runPhase(
        phaseUnits(ctx, units, { mode: 'run', phaseRun, done, coldAlone: decision.coldAlone ? 'all' : 'largest' }, r =>
          results.push(r),
        ),
      );
      // Hits only affect later phases, so the escalation rule stays exact under concurrency.
      for (const r of results) {
        for (const record of r.records.filter(
          x => !x.ok && !x.cold && x.errorCategory && isLimitCategory(x.errorCategory),
        )) {
          const k = `${record.caseId}|${record.variant}`;
          hits.set(k, [...(hits.get(k) ?? []), { bucket: record.bucket, windowMs: record.windowMs }]);
        }
      }
      if (concurrencyAtStart === 1) break;

      // Sentinels: the same cases on the phase's representative project, alone.
      const bucket = phase.split(':')[0] as Bucket;
      const project = representative(selection, bucket);
      const sentinelUnits = planned.filter(
        u =>
          u.phase === phase &&
          u.project.hash === project.hash &&
          u.variant === 'base' &&
          SENTINEL_CASES.includes(u.def.id),
      );
      const sentinelResults: UnitResult[] = [];
      await ctx.pool.runPhase(
        phaseUnits(ctx, sentinelUnits, { mode: 'sentinel', phaseRun, exclusive: true, keyExtra: phaseRun }, r =>
          sentinelResults.push(r),
        ),
      );
      const concurrent = results.flatMap(r => r.records);
      const verdict = compareSentinels(
        concurrent,
        sentinelResults.flatMap(r => r.records),
      );
      const latencyHigh = verdict.latencyRatio > 1.15;
      log(
        `sentinels ${phase}: ${verdict.cells.length} cells, memory drift ${verdict.memoryDrift ? 'YES' : 'no'}, warm latency ratio ${verdict.latencyRatio.toFixed(2)}; ` +
          verdict.cells
            .map(
              c =>
                `${c.cell.split('|')[0]}:${c.cell.split('|')[2]} mem ×${c.memoryRatio.toFixed(2)}${c.liveReadSet ? ' (live, not compared)' : ''} lat ×${c.latencyRatio.toFixed(2)}`,
            )
            .join(', '),
      );
      const drift = verdict.memoryDrift || (latencyHigh && previousLatencyHigh);
      previousLatencyHigh = latencyHigh;
      if (!drift) break;
      ctx.pool.reduce(Math.floor(ctx.pool.concurrency / 2), `sentinel drift in ${phase}`);
      superseded.add(phaseRun);
      writeJson(f.superseded, [...superseded]);
      log(`phase ${phase} superseded; re-running at concurrency ${ctx.pool.concurrency}`);
      previousLatencyHigh = false;
    }
  }
}

/** The A/B proof: per (project, window) pair, arm A sequential and arm B concurrent, alternating order. */
export async function runProbe(
  ctx: TqContext,
  selection: Selection,
  levels: number[],
  scope: { buckets: Bucket[]; windows: WindowStage[]; blocks?: number } = {
    buckets: PROBE_BUCKETS,
    windows: PROBE_WINDOWS,
  },
): Promise<ConcurrencyDecision> {
  const f = files(ctx.resultsDir);
  mkdirSync(ctx.resultsDir, { recursive: true });
  const verdicts: ProbeVerdict[] = [];
  for (const level of levels) {
    // Repeating the pairs as extra blocks keeps the A/B order alternating even for a single pair.
    const pairs = Array.from({ length: scope.blocks ?? 1 }, () =>
      scope.buckets.flatMap(bucket =>
        scope.windows.map(w => ({ project: representative(selection, bucket), window: WINDOWS[w] })),
      ),
    ).flat();
    for (const [i, { project, window }] of pairs.entries()) {
      const units: Planned[] = PROBE_CASES.map(id => ({
        def: caseById(id),
        variant: 'base' as Variant,
        window,
        project,
        phase: phaseOf(project.bucket, windowStage(window)),
      }));
      const arms: Array<'A' | 'B'> = i % 2 === 0 ? ['A', 'B'] : ['B', 'A'];
      for (const arm of arms) {
        const pool = (ctx.newPool ?? newPool)(arm === 'A' ? 1 : level);
        const armCtx = { ...ctx, pool };
        const phaseRun = `${ctx.runId}:probe:${level}:${i}:${arm}`;
        await pool.runPhase(
          phaseUnits(
            armCtx,
            units,
            { mode: 'probe', phaseRun, arm, probeLevel: level, keyExtra: phaseRun, exclusive: arm === 'A' },
            () => {},
          ),
        );
        if (pool.overloadCount > 0) log(`probe level ${level} arm ${arm}: ${pool.overloadCount} overloads`);
      }
    }
    const verdict = evaluateProbe(
      readRecords<TqRecord>(f.probe).filter(r => r.runId === ctx.runId),
      level,
    );
    verdicts.push(verdict);
    logVerdict(verdict);
    if (verdict.pass) break;
  }
  const decision = decide(verdicts);
  writeJson(f.concurrency, decision);
  log(`concurrency decision: ${decision.level}${decision.coldAlone ? ' (cold reps alone)' : ''}`);
  return decision;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const RELATION_TABLES: Record<string, string> = {
  feedback: 'mastra_feedback_events',
  scores: 'mastra_score_events_current',
  spans: 'mastra_span_events',
};

/**
 * Relations the replica cannot serve: the table is missing or lacks a column the store's SQL uses.
 * Missing columns on any other table still abort the run.
 */
export function unavailableRelations(pre: Pick<Preflight, 'missingTables' | 'missingColumns'>): string[] {
  const relationTables = new Set(Object.values(RELATION_TABLES));
  const other = Object.keys(pre.missingColumns).filter(t => !relationTables.has(t));
  if (other.length) throw new Error(`Preflight reported missing required columns on ${other.join(', ')}`);
  return Object.entries(RELATION_TABLES)
    .filter(([, table]) => pre.missingTables.includes(table) || pre.missingColumns[table]?.length)
    .map(([relation]) => relation);
}

function parseFilter(
  values: Record<string, string | boolean | undefined>,
  deltaAvailable: boolean,
  unavailable: string[] = [],
): RunFilter {
  if (!values.buckets) throw new Error('--buckets is required');
  return {
    buckets: list(values.buckets as string, BUCKETS, []),
    windows: list(values.windows as string | undefined, WINDOW_ORDER, [...WINDOW_ORDER]),
    cases: values.cases ? (values.cases as string).split(',') : undefined,
    gateBApproved: Boolean(values['gate-b-approved']),
    deltaAvailable,
    unavailable,
  };
}

async function main(): Promise<void> {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      buckets: { type: 'string' },
      windows: { type: 'string' },
      cases: { type: 'string' },
      levels: { type: 'string', default: '4,2' },
      blocks: { type: 'string', default: '1' },
      concurrency: { type: 'string' },
      tier: { type: 'string', default: '1' },
      'gate-b-approved': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'tier-3-approved': { type: 'boolean', default: false },
      'accept-readonly-0': { type: 'boolean', default: false },
      evaluate: { type: 'boolean', default: false },
    },
  });
  const command = positionals[0];
  const runId = randomUUID().slice(0, 8);
  const f = files();

  if (command === 'report') {
    const { writeReport } = await import('./report');
    writeReport();
    return;
  }

  if (command === 'probe' && values.evaluate) {
    // Re-decide from stored probe records (no connection), e.g. after an evaluation fix.
    const records = readRecords<TqRecord>(f.probe);
    const runIdToEval = records.at(-1)?.runId;
    const ofRun = records.filter(r => r.runId === runIdToEval);
    const levels = [...new Set(ofRun.map(r => r.probeLevel!))].sort((x, y) => y - x);
    const verdicts = levels.map(level => evaluateProbe(ofRun, level));
    for (const v of verdicts) logVerdict(v);
    const decision = decide(verdicts);
    writeJson(f.concurrency, decision);
    log(
      `concurrency decision (re-evaluated, probe run ${runIdToEval}): ${decision.level}${decision.coldAlone ? ' (cold reps alone)' : ''}`,
    );
    return;
  }

  const tierId = Number(values.tier) as 1 | 2 | 3;
  if (!TIERS[tierId]) throw new Error('--tier must be 1, 2 or 3');
  if (tierId === 3 && !values['tier-3-approved']) throw new Error('Tier 3 requires explicit approval');
  const tier = TIERS[tierId];

  const selection = loadSelection();
  if (!selection)
    throw new Error('No selection at ~/.cache/aqa-bench/selection.json (produced by the aggregate suite)');
  const sidecar = loadSidecar();
  const pre = existsSync(f.preflight) ? readJson<Preflight>(f.preflight) : undefined;
  const deltaAvailable = Boolean(pre && !pre.missingTables.includes(DELTA_TABLE));
  const unavailable = pre ? unavailableRelations(pre) : [];

  if (command === 'run' && values['dry-run']) {
    const filter = parseFilter(values, deltaAvailable, unavailable);
    const planned = planUnits(selection, filter);
    for (const phase of phaseOrder(filter)) {
      const units = planned.filter(u => u.phase === phase);
      log(`phase ${phase}: ${units.length} units`);
      for (const u of units)
        log(`  ${u.project.hash} ${u.def.id}/${u.variant}/${u.window.id} [${u.def.stages.join(',')}]`);
    }
    log(
      `${planned.length} units; delta cases ${deltaAvailable ? 'included' : 'excluded (no delta table in preflight)'}` +
        (unavailable.length ? `; ${unavailable.join('/')} relation cases excluded (replica schema)` : ''),
    );
    return;
  }

  const credentials = loadCredentials();
  if (command === 'preflight') {
    const client = connect(credentials);
    try {
      const result = await preflight(
        client,
        { runId, acceptReadonly0: values['accept-readonly-0'] },
        { tables: TABLES, requiredColumns: REQUIRED_COLUMNS },
      );
      mkdirSync(RESULTS_DIR, { recursive: true });
      writeJson(f.preflight, result);
      logPreflight(result, TABLES.length);
      const metaClient = connect(credentials, result.database);
      const capacity = await capacityCheck(metaClient, runId, tier).finally(() => metaClient.close());
      writeJson(f.capacity, capacity);
      log(
        `capacity: cores ${capacity.cpuCores ?? 'unknown'}, memory ${capacity.memoryBytes ? `${(capacity.memoryBytes / 2 ** 30).toFixed(0)} GiB` : 'unknown'}, running queries ${capacity.runningQueries ?? 'unknown'}, settings ${JSON.stringify(capacity.serverSettings)}, max concurrency ${capacity.maxConcurrency ?? 'unknown (probe decides)'}`,
      );
    } finally {
      await client.close();
    }
    return;
  }

  if (!pre) throw new Error('Run `preflight` first');
  if (unavailable.length) log(`relation cases excluded (replica schema): ${unavailable.join(', ')}`);
  const decision = existsSync(f.concurrency) ? readJson<ConcurrencyDecision>(f.concurrency) : undefined;
  const capacity = existsSync(f.capacity) ? readJson<Capacity>(f.capacity) : undefined;

  let concurrency = 1;
  if (command === 'run') {
    if (!decision) throw new Error('No concurrency decision; run `probe` first (no counted result before the proof)');
    concurrency = decision.level;
    if (values.concurrency !== undefined) concurrency = Math.min(concurrency, Number(values.concurrency));
  } else if (command === 'probe') {
    concurrency = Math.max(...values.levels!.split(',').map(Number));
  }
  const client = connect(credentials, pre.database, concurrency);
  const pool = newPool(concurrency);
  const ctx: TqContext = {
    client,
    pool,
    queryLog: pre.queryLog,
    runId,
    tier,
    anchorTo: selection.anchorTo,
    sidecar,
    resultsDir: RESULTS_DIR,
  };
  try {
    await preflightReadonly(client, runId, pre.readonly);
    if (command === 'discover') {
      const discovered = await discoverSidecar(
        {
          client,
          tier,
          logComment: step => `aqa-bench:${runId}:${step}`,
          pause: () => new Promise(r => setTimeout(r, PAUSE_MS)),
        },
        selection,
      );
      saveSidecar(discovered);
      writeJson(f.literals, publicSidecar(discovered, selection));
      log(`sidecar saved (${Object.keys(discovered.projects).length} projects)`);
    } else if (command === 'probe') {
      if (!sidecar) throw new Error('Run `discover` first');
      let levels = values
        .levels!.split(',')
        .map(Number)
        .filter(n => Number.isInteger(n) && n > 1 && n <= 8);
      if (capacity?.maxConcurrency) levels = levels.filter(l => l <= capacity.maxConcurrency!);
      if (levels.length === 0) {
        log('capacity check allows no concurrency above 1; deciding sequential');
        writeJson(f.concurrency, decide([]));
        return;
      }
      const blocks = Number(values.blocks);
      if (!Number.isInteger(blocks) || blocks < 1 || blocks > 4) throw new Error('--blocks must be 1-4');
      await runProbe(ctx, selection, levels, {
        buckets: list(values.buckets, BUCKETS, PROBE_BUCKETS),
        windows: list(values.windows, WINDOW_ORDER, PROBE_WINDOWS),
        blocks,
      });
    } else if (command === 'run') {
      if (!sidecar) throw new Error('Run `discover` first');
      await runPhases(ctx, selection, parseFilter(values, deltaAvailable, unavailable), decision!);
    } else {
      throw new Error('Usage: run.ts preflight | discover | probe | run --buckets … | report');
    }
  } catch (error) {
    if (error instanceof PoolAborted) log(`ABORTED: ${error.message}`);
    throw error;
  } finally {
    await client.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}

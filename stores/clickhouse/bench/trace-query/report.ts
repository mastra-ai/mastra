/**
 * Renders the generated section of FINDINGS.md from results/*.jsonl. Memory is shown first in
 * every cell. Superseded phase runs are excluded; probe and sentinel records are reported only in
 * their own tables.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUCKETS } from '../shared/profile';
import type { Bucket } from '../shared/profile';
import {
  BUDGET,
  fmtBytes,
  fmtMem,
  fmtMs,
  fmtRows,
  groupBy,
  logLogSlope,
  median,
  spliceReport,
} from '../shared/report-kit';
import { readJson, readRecords } from '../shared/runner';
import { CASES } from './cases';
import type { Api, Stage } from './cases';
import { evaluateProbe, files } from './run';
import type { SkipRecord, TqRecord } from './run';

export const FINDINGS_FILE = join(import.meta.dirname, 'FINDINGS.md');

const MiB = 2 ** 20;
/** The store's own per-API defaults (stores/clickhouse v-next index.ts / span-query.ts). */
export const STORE_LIMITS: Record<'default' | 'discovery' | 'spans', { timeoutMs: number; memory: number | null }> = {
  default: { timeoutMs: 15_000, memory: null },
  discovery: { timeoutMs: 5_000, memory: 256 * MiB },
  spans: { timeoutMs: 15_000, memory: 512 * MiB },
};

export function storeLimitFor(api: Api): (typeof STORE_LIMITS)[keyof typeof STORE_LIMITS] {
  if (api === 'fields' || api === 'values') return STORE_LIMITS.discovery;
  if (api === 'spans') return STORE_LIMITS.spans;
  return STORE_LIMITS.default;
}

const API_SECTIONS: Array<{ title: string; apis: Api[] }> = [
  { title: 'queryTraces(), keyset mode', apis: ['traces'] },
  { title: 'queryTraces(), page mode, groups and delta', apis: ['page', 'groups', 'delta', 'delta-head'] },
  { title: 'queryThreads()', apis: ['threads'] },
  { title: 'querySpans()', apis: ['spans'] },
  { title: 'Discovery: getTraceQueryObservedFields() / getTraceQueryValues()', apis: ['fields', 'values'] },
];

const isWhatIf = (r: Pick<TqRecord, 'variant' | 'stage'>) => r.variant !== 'base' || r.stage.endsWith('-scoped');

export interface Cell {
  peakMemory: number;
  warmMedianMs: number;
  warmMaxMs: number;
  coldMs: number | null;
  readRows: number;
  readBytes: number;
  failures: string[];
  runs: number;
}

export function summarize(records: TqRecord[]): Cell | null {
  if (!records.length) return null;
  const ok = records.filter(r => r.ok);
  const warm = ok.filter(r => !r.cold).map(r => r.metrics.durationMs);
  const cold = ok.filter(r => r.cold).map(r => r.metrics.durationMs);
  return {
    peakMemory: Math.max(0, ...records.map(r => r.metrics.memoryBytes ?? 0)),
    warmMedianMs: median(warm),
    warmMaxMs: warm.length ? Math.max(...warm) : Number.NaN,
    coldMs: cold.length ? median(cold) : null,
    readRows: median(ok.map(r => r.metrics.readRows)),
    readBytes: median(ok.map(r => r.metrics.readBytes)),
    failures: [...new Set(records.filter(r => !r.ok).map(r => r.errorCategory ?? 'other'))],
    runs: records.length,
  };
}

function cellText(cell: Cell | null): string {
  if (!cell) return '–';
  const fail = cell.failures.length ? ` ✗${cell.failures.join('/')}` : '';
  if (!Number.isFinite(cell.warmMedianMs)) return `✗ ${cell.failures.join('/')}`;
  const cold = cell.coldMs === null ? '' : ` (cold ${fmtMs(cell.coldMs)})`;
  return `**${fmtMem(cell.peakMemory)}** · ${fmtMs(cell.warmMedianMs)} / ${fmtMs(cell.warmMaxMs)}${cold}<br>${fmtRows(cell.readRows)} rows · ${fmtBytes(cell.readBytes)}${fail}`;
}

export function rowLabel(r: Pick<TqRecord, 'caseId' | 'variant' | 'stage'>): string {
  return `${r.caseId}${r.variant === 'base' ? '' : `-${r.variant}`}${r.stage === 'main' ? '' : ` ${r.stage}`}`;
}

const caseIndex = (id: string) => {
  const i = CASES.findIndex(c => c.id === id);
  return i === -1 ? CASES.length : i;
};
const STAGE_ORDER: Stage[] = [
  'main',
  'payload',
  'payload-scoped',
  'span-payload',
  'span-metrics',
  'span-payload-scoped',
  'span-metrics-scoped',
];

function sortRows(rows: Map<string, TqRecord[]>): string[] {
  return [...rows.keys()].sort((a, b) => {
    const ra = rows.get(a)![0]!;
    const rb = rows.get(b)![0]!;
    return (
      caseIndex(ra.caseId) - caseIndex(rb.caseId) ||
      ra.variant.localeCompare(rb.variant) ||
      STAGE_ORDER.indexOf(ra.stage) - STAGE_ORDER.indexOf(rb.stage) ||
      ra.windowMs - rb.windowMs
    );
  });
}

function apiTables(records: TqRecord[], buckets: Bucket[]): string[] {
  const out: string[] = [];
  for (const { title, apis } of API_SECTIONS) {
    const rs = records.filter(r => apis.includes(r.api) && !isWhatIf(r));
    if (!rs.length) continue;
    out.push(
      `### ${title}`,
      '',
      `| case | window | ${buckets.join(' | ')} |`,
      `|---|---|${buckets.map(() => '---').join('|')}|`,
    );
    const rows = groupBy(rs, r => `${rowLabel(r)}\u0000${r.window}`);
    for (const key of sortRows(rows)) {
      const [label, window] = key.split('\u0000');
      out.push(
        `| ${label} | ${window} | ${buckets.map(b => cellText(summarize(rows.get(key)!.filter(r => r.bucket === b)))).join(' | ')} |`,
      );
    }
    out.push('');
  }
  return out;
}

/** Peak memory per API and bucket, with the budgets and the store's own limit. */
function peakTable(records: TqRecord[], buckets: Bucket[]): string[] {
  const out = [`| API | store limit | ${buckets.join(' | ')} |`, `|---|---|${buckets.map(() => '---').join('|')}|`];
  for (const { title, apis } of API_SECTIONS) {
    const rs = records.filter(r => apis.includes(r.api) && !isWhatIf(r));
    if (!rs.length) continue;
    const limit = storeLimitFor(apis[0]!);
    const cells = buckets.map(b => {
      const inB = rs.filter(r => r.bucket === b);
      if (!inB.length) return '–';
      const peak = inB.reduce((m, r) => ((r.metrics.memoryBytes ?? 0) > (m.metrics.memoryBytes ?? 0) ? r : m));
      return `${fmtMem(peak.metrics.memoryBytes ?? 0)} (${rowLabel(peak)} ${peak.window})`;
    });
    out.push(
      `| ${title} | ${fmtMs(limit.timeoutMs)}${limit.memory ? ` / ${fmtMem(limit.memory)}` : ''} | ${cells.join(' | ')} |`,
    );
  }
  return out;
}

function flags(records: TqRecord[]): string[] {
  const out: string[] = [];
  for (const [label, rs] of groupBy(
    records.filter(r => !isWhatIf(r)),
    r => `${rowLabel(r)} ${r.window} @ ${r.bucket}`,
  )) {
    const cell = summarize(rs)!;
    const limit = storeLimitFor(rs[0]!.api);
    const reasons: string[] = [];
    if (cell.failures.length) reasons.push(`failed: ${cell.failures.join('/')}`);
    if (cell.peakMemory > BUDGET.hardMemory) reasons.push(`memory ${fmtMem(cell.peakMemory)} > 4 GiB`);
    else if (cell.peakMemory > BUDGET.comfortableMemory) reasons.push(`memory ${fmtMem(cell.peakMemory)} > 1 GiB`);
    if (limit.memory && cell.peakMemory > limit.memory)
      reasons.push(`memory ${fmtMem(cell.peakMemory)} > store limit ${fmtMem(limit.memory)}`);
    if (cell.warmMedianMs > limit.timeoutMs)
      reasons.push(`warm median ${fmtMs(cell.warmMedianMs)} > store timeout ${fmtMs(limit.timeoutMs)}`);
    else if (cell.warmMaxMs > limit.timeoutMs)
      reasons.push(`warm max ${fmtMs(cell.warmMaxMs)} > store timeout ${fmtMs(limit.timeoutMs)}`);
    if (cell.coldMs !== null && cell.coldMs > limit.timeoutMs)
      reasons.push(`cold ${fmtMs(cell.coldMs)} > store timeout ${fmtMs(limit.timeoutMs)}`);
    if (reasons.length) out.push(`- **${label}**: ${reasons.join('; ')}`);
  }
  return out.length ? out : ['- None.'];
}

/** What-if ratios (warm medians): time, bytes read and memory, relative to the as-compiled statement. */
function whatIf(records: TqRecord[], buckets: Bucket[]): string[] {
  const baseOf = (r: TqRecord): Pick<TqRecord, 'variant' | 'stage'> =>
    r.variant !== 'base'
      ? { variant: 'base', stage: r.stage }
      : { variant: 'base', stage: r.stage.replace(/-scoped$/, '') as Stage };
  const warm = records.filter(r => r.ok && !r.cold);
  const alts = groupBy(warm.filter(isWhatIf), r => `${rowLabel(r)}\u0000${r.window}`);
  if (!alts.size) return ['No what-if runs yet.'];
  const out = [
    'Ratios are what-if ÷ as-compiled (warm medians): time · bytes read · memory.',
    '',
    `| what-if | window | ${buckets.join(' | ')} |`,
    `|---|---|${buckets.map(() => '---').join('|')}|`,
  ];
  for (const key of sortRows(alts)) {
    const rs = alts.get(key)!;
    const [label, window] = key.split('\u0000');
    const b0 = baseOf(rs[0]!);
    const cells = buckets.map(bucket => {
      const alt = rs.filter(r => r.bucket === bucket);
      const base = warm.filter(
        r =>
          r.bucket === bucket &&
          r.caseId === rs[0]!.caseId &&
          r.window === window &&
          r.variant === b0.variant &&
          r.stage === b0.stage,
      );
      if (!alt.length || !base.length) return '–';
      const q = (f: (r: TqRecord) => number) => (median(alt.map(f)) / Math.max(1, median(base.map(f)))).toFixed(2);
      return `×${q(r => r.metrics.durationMs)} · ×${q(r => r.metrics.readBytes)} · ×${q(r => r.metrics.memoryBytes ?? 0)}`;
    });
    out.push(`| ${label} | ${window} | ${cells.join(' | ')} |`);
  }
  return out;
}

function scaling(records: TqRecord[]): string[] {
  const out = [
    '| case | window | memory slope | latency slope | read-bytes slope | projects |',
    '|---|---|---|---|---|---|',
  ];
  for (const [key, rs] of groupBy(
    records.filter(r => r.ok && !r.cold && !isWhatIf(r)),
    r => `${rowLabel(r)}\u0000${r.window}`,
  )) {
    const per = [...groupBy(rs, r => r.hash).values()].map(p => ({
      traces: p[0]!.traces30d,
      mem: median(p.map(r => r.metrics.memoryBytes ?? 0)),
      ms: median(p.map(r => r.metrics.durationMs)),
      bytes: median(p.map(r => r.metrics.readBytes)),
    }));
    const latency = logLogSlope(per.map(p => [p.traces, p.ms]));
    if (latency === null) continue;
    const mem = logLogSlope(per.map(p => [p.traces, p.mem]));
    const bytes = logLogSlope(per.map(p => [p.traces, p.bytes]));
    const [label, window] = key.split('\u0000');
    out.push(
      `| ${label} | ${window} | ${mem?.toFixed(2) ?? '–'} | ${latency.toFixed(2)} | ${bytes?.toFixed(2) ?? '–'} | ${per.length} |`,
    );
  }
  return out.length > 2 ? out : ['Not enough distinct project sizes yet.'];
}

/** Bootstrap 90% CI of the median of per-cell ratios (deterministic seed). */
export function bootstrapCi(values: number[], iterations = 2_000): [number, number] | null {
  if (values.length < 2) return null;
  let seed = 0x9e3779b9;
  const rand = () => (seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32;
  const medians: number[] = [];
  for (let i = 0; i < iterations; i++)
    medians.push(median(values.map(() => values[Math.floor(rand() * values.length)]!)));
  medians.sort((a, b) => a - b);
  return [medians[Math.floor(iterations * 0.05)]!, medians[Math.floor(iterations * 0.95)]!];
}

function probeSection(probe: TqRecord[]): string[] {
  if (!probe.length) return ['No probe run yet.'];
  const out: string[] = [];
  for (const [, ofRun] of groupBy(probe, r => r.runId)) {
    const buckets = [...new Set(ofRun.map(r => r.bucket))].join(', ');
    const windows = [...new Set(ofRun.map(r => r.window))].join(', ');
    const levels = [...new Set(ofRun.map(r => r.probeLevel).filter((l): l is number => l !== undefined))].sort(
      (a, b) => b - a,
    );
    out.push(...probeRunSection(ofRun, levels, `${buckets} at ${windows}`));
  }
  return out;
}

function probeRunSection(probe: TqRecord[], levels: number[], scope: string): string[] {
  const out: string[] = [];
  for (const level of levels) {
    const v = evaluateProbe(probe, level);
    const ci = (f: (c: (typeof v.cells)[number]) => number | null) => {
      const r = bootstrapCi(v.cells.map(f).filter((x): x is number => x !== null));
      return r ? ` [${r[0].toFixed(3)}–${r[1].toFixed(3)}]` : '';
    };
    out.push(
      `#### Concurrency ${level} vs sequential (${scope}): ${v.pass ? 'PASS' : v.passWithColdAlone ? 'PASS with cold reps alone' : 'FAIL'}`,
      '',
      '| measure (B ÷ A) | median of cells [90% CI] | criterion | ok |',
      '|---|---|---|---|',
      `| memory | ×${v.memoryMedian.toFixed(3)}${ci(c => c.memory)} | within ±5 %, every cell ±10 % | ${v.checks.memoryMedian && v.checks.memoryEvery ? '✓' : '✗'} |`,
      `| read rows / bytes | ×${median(v.cells.map(c => c.readRows)).toFixed(3)} / ×${median(v.cells.map(c => c.readBytes)).toFixed(3)} | every cell ±1 % | ${v.checks.rowsBytes ? '✓' : '✗'} |`,
      `| warm latency, median | ×${v.warmMedian.toFixed(2)}${ci(c => c.warmMedian)} | ≤ 1.10 | ${v.checks.warmMedian ? '✓' : '✗'} |`,
      `| warm latency, p90 | ×${v.warmP90.toFixed(2)}${ci(c => c.warmP90)} | ≤ 1.20 | ${v.checks.warmP90 ? '✓' : '✗'} |`,
      `| cold latency | ×${v.coldMedian.toFixed(2)}${ci(c => c.cold)} | ≤ 1.15 | ${v.checks.cold ? '✓' : '✗'} |`,
      `| overload errors | ${v.overloads} | 0 | ${v.checks.overload ? '✓' : '✗'} |`,
      '',
      `${v.cells.length} cells (case × stage × project × window). Per cell:`,
      '',
      '| cell | memory | rows | bytes | warm median | warm p90 | cold |',
      '|---|---|---|---|---|---|---|',
      ...v.cells.map(c => {
        const [caseId, , stage, window, hash] = c.cell.split('|');
        return `| ${caseId}${stage === 'main' ? '' : ` ${stage}`} ${window} ${hash} | ×${c.memory.toFixed(3)} | ×${c.readRows.toFixed(3)} | ×${c.readBytes.toFixed(3)} | ×${c.warmMedian.toFixed(2)} | ×${c.warmP90.toFixed(2)} | ${c.cold === null ? '–' : `×${c.cold.toFixed(2)}`} |`;
      }),
      '',
    );
  }
  return out;
}

function sentinelSection(runs: TqRecord[], sentinels: TqRecord[], superseded: Set<string>): string[] {
  if (!sentinels.length) return ['No sentinel runs (sequential run, or none yet).'];
  const out = [
    '| phase run | cells | memory ratio (median) | warm latency ratio (median) | superseded |',
    '|---|---|---|---|---|',
  ];
  for (const [phaseRun, ss] of groupBy(sentinels, r => r.phaseRun)) {
    const con = runs.filter(r => r.phaseRun === phaseRun && r.ok && !r.cold);
    const ratios = [
      ...groupBy(
        ss.filter(r => r.ok && !r.cold),
        r => [r.caseId, r.stage, r.window, r.hash].join('|'),
      ),
    ].flatMap(([cell, seq]) => {
      const c = con.filter(r => [r.caseId, r.stage, r.window, r.hash].join('|') === cell);
      if (!c.length) return [];
      return [
        {
          mem:
            median(c.map(r => r.metrics.memoryBytes ?? 0)) /
            Math.max(1, median(seq.map(r => r.metrics.memoryBytes ?? 0))),
          ms: median(c.map(r => r.metrics.durationMs)) / Math.max(1, median(seq.map(r => r.metrics.durationMs))),
        },
      ];
    });
    if (!ratios.length) continue;
    out.push(
      `| ${phaseRun.split(':').slice(1).join(':')} | ${ratios.length} | ×${median(ratios.map(r => r.mem)).toFixed(3)} | ×${median(ratios.map(r => r.ms)).toFixed(2)} | ${superseded.has(phaseRun) ? 'yes' : 'no'} |`,
    );
  }
  return out;
}

/** Spearman rank correlation between inFlight and latency normalized by its cell's median. */
export function inFlightCorrelation(records: TqRecord[]): { rho: number; n: number } | null {
  const warm = records.filter(r => r.ok && !r.cold);
  const points: Array<[number, number]> = [];
  for (const rs of groupBy(warm, r => [r.caseId, r.variant, r.stage, r.window, r.hash].join('|')).values()) {
    const m = median(rs.map(r => r.metrics.durationMs));
    if (m > 0) for (const r of rs) points.push([r.inFlight, r.metrics.durationMs / m]);
  }
  if (points.length < 10) return null;
  const rank = (xs: number[]) => {
    const sorted = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const ranks = new Array<number>(xs.length);
    for (let i = 0; i < sorted.length;) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1]![0] === sorted[i]![0]) j++;
      for (let k = i; k <= j; k++) ranks[sorted[k]![1]] = (i + j) / 2;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(points.map(p => p[0]));
  const ry = rank(points.map(p => p[1]));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return { rho: dx && dy ? num / Math.sqrt(dx * dy) : 0, n: points.length };
}

function skipSection(skips: SkipRecord[]): string[] {
  const rows = groupBy(
    skips.filter(s => s.mode === 'run'),
    s => `${s.caseId}\u0000${s.reason}`,
  );
  if (!rows.size) return ['- None.'];
  return [...rows].map(([key, ss]) => {
    const [caseId, reason] = key.split('\u0000');
    return `- **${caseId}** (${reason}): ${[...new Set(ss.map(s => `${s.bucket} ${s.window}`))].join(', ')}`;
  });
}

export function renderReport(all: TqRecord[], probe: TqRecord[], skips: SkipRecord[], superseded: Set<string>): string {
  const live = all.filter(r => !superseded.has(r.phaseRun));
  const runs = live.filter(r => r.mode === 'run');
  const sentinels = all.filter(r => r.mode === 'sentinel');
  const buckets = BUCKETS.filter(b => runs.some(r => r.bucket === b));
  const corr = inFlightCorrelation(runs);
  return [
    '## Results (generated)',
    '',
    `${runs.length} counted query executions (${runs.filter(r => !r.ok).length} failed), ${probe.length} probe and ${sentinels.length} sentinel executions; ${all.length - live.length} superseded executions excluded.`,
    '',
    'Cells: **peak memory** · warm median / warm max (cold) · median rows and bytes read; ✗ marks failures by category.',
    '',
    '### Peak memory per API',
    '',
    ...peakTable(runs, buckets),
    '',
    '### Over budget or store limit',
    '',
    ...flags(runs),
    '',
    ...apiTables(runs, buckets),
    '### What-if rewrites',
    '',
    ...whatIf(runs, buckets),
    '',
    '### Scaling with project size (log-log slope vs 30-day trace count)',
    '',
    ...scaling(runs),
    '',
    '### Concurrency proof',
    '',
    ...probeSection(probe),
    '#### Sentinels (sequential re-runs after each phase)',
    '',
    ...sentinelSection(runs, sentinels, superseded),
    '',
    `#### Latency vs queries in flight: ${corr ? `Spearman ρ = ${corr.rho.toFixed(3)} over ${corr.n} warm executions (latency normalized per cell)` : 'not enough data'}`,
    '',
    '### Skipped',
    '',
    ...skipSection(skips),
    '',
  ].join('\n');
}

export function writeReport(dir?: string): void {
  const f = files(dir);
  const superseded = new Set<string>(existsSync(f.superseded) ? readJson<string[]>(f.superseded) : []);
  const generated = renderReport(
    readRecords<TqRecord>(f.runs),
    readRecords<TqRecord>(f.probe),
    readRecords<SkipRecord>(f.skips),
    superseded,
  );
  const current = existsSync(FINDINGS_FILE) ? readFileSync(FINDINGS_FILE, 'utf8') : undefined;
  writeFileSync(FINDINGS_FILE, spliceReport(current, generated, 'Trace-query benchmark findings'));
  process.stdout.write('FINDINGS.md generated section updated\n');
}

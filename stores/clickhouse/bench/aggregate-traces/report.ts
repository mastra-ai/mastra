/**
 * Turns results/*.jsonl (+ preflight/profile summaries) into the generated section of FINDINGS.md.
 * Hand-written prose outside the `report:start` / `report:end` markers is preserved.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CASES } from './cases';
import { BUCKETS } from './profile';
import type { Bucket } from './profile';
import { MEMORY_FILE, PREFLIGHT_FILE, PROFILE_FILE, readRecords } from './run';
import type { RunRecord } from './run';

export const FINDINGS_FILE = join(import.meta.dirname, 'FINDINGS.md');
const START = '<!-- report:start -->';
const END = '<!-- report:end -->';

export const BUDGET = { timeoutMs: 15_000, hardTimeoutMs: 30_000, comfortableMemory: 2 ** 30, hardMemory: 4 * 2 ** 30 };

const GROUP_TITLES: Record<string, string> = {
  canonical: 'Canonical decision-doc examples',
  tokens: 'Token and cost measures',
  highcard: 'High-cardinality groupBy',
  interval: 'Interval path at the bucket cap',
  pushdown: 'Pushed-down vs non-pushed `where`',
  distinct: 'countDistinct',
  percentile: 'Percentiles',
  baseline: '`queryTraces()` baseline (same selection)',
};

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Least-squares slope of log(y) against log(x). */
export function logLogSlope(points: Array<[number, number]>): number | null {
  const usable = points.filter(([x, y]) => x > 0 && y > 0).map(([x, y]) => [Math.log(x), Math.log(y)] as const);
  if (new Set(usable.map(([x]) => x)).size < 3) return null;
  const mx = usable.reduce((s, [x]) => s + x, 0) / usable.length;
  const my = usable.reduce((s, [, y]) => s + y, 0) / usable.length;
  const num = usable.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const den = usable.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

const fmtMs = (ms: number) =>
  ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
const fmtBytes = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e3).toFixed(0)} kB`;
const fmtMem = (b: number) => (b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(2)} GiB` : `${(b / 2 ** 20).toFixed(0)} MiB`);
const fmtRows = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} k` : `${n}`;

export interface Cell {
  warmMedianMs: number;
  warmMaxMs: number;
  coldMs: number | null;
  readRows: number;
  readBytes: number;
  peakMemory: number;
  failures: string[];
  runs: number;
  /** The first run kept the filesystem cache (shared-instance mode), so it is not a cold read. */
  firstNotCold: boolean;
}

export function summarize(records: RunRecord[]): Cell | null {
  if (!records.length) return null;
  const ok = records.filter(r => r.ok);
  const warm = ok.filter(r => !r.cold).map(r => r.metrics.durationMs);
  const cold = ok.filter(r => r.cold).map(r => r.metrics.durationMs);
  return {
    warmMedianMs: median(warm),
    warmMaxMs: warm.length ? Math.max(...warm) : Number.NaN,
    coldMs: cold.length ? median(cold) : null,
    readRows: median(ok.map(r => r.metrics.readRows)),
    readBytes: median(ok.map(r => r.metrics.readBytes)),
    peakMemory: Math.max(0, ...records.map(r => r.metrics.memoryBytes ?? 0)),
    failures: [...new Set(records.filter(r => !r.ok).map(r => r.errorCategory ?? 'other'))],
    runs: records.length,
    firstNotCold: records.some(r => r.cold && r.coldBypass === false),
  };
}

function cellText(cell: Cell | null): string {
  if (!cell) return '–';
  if (!Number.isFinite(cell.warmMedianMs)) return `✗ ${cell.failures.join('/')}`;
  const fail = cell.failures.length ? ` ✗${cell.failures.join('/')}` : '';
  const cold = cell.coldMs === null ? '' : ` (${cell.firstNotCold ? 'first' : 'cold'} ${fmtMs(cell.coldMs)})`;
  return `${fmtMs(cell.warmMedianMs)} / ${fmtMs(cell.warmMaxMs)}${cold}<br>${fmtRows(cell.readRows)} rows · ${fmtBytes(cell.readBytes)} · ${fmtMem(cell.peakMemory)}${fail}`;
}

export function rowLabel(r: Pick<RunRecord, 'caseId' | 'variant' | 'stage'>): string {
  return `${r.caseId}${r.variant === 'base' ? '' : `-${r.variant}`}${r.stage === 'main' ? '' : ` ${r.stage}`}`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

function caseOrder(id: string): number {
  const index = CASES.findIndex(c => c.id === id);
  return index === -1 ? CASES.length : index;
}

function groupTables(records: RunRecord[], buckets: Bucket[]): string[] {
  const out: string[] = [];
  for (const [group, title] of Object.entries(GROUP_TITLES)) {
    const groupRecords = records.filter(r => r.group === group);
    if (!groupRecords.length) continue;
    out.push(`### ${title}`, '');
    out.push(`| case | window | ${buckets.join(' | ')} |`, `|---|---|${buckets.map(() => '---').join('|')}|`);
    const rows = groupBy(groupRecords, r => `${rowLabel(r)}\u0000${r.window}`);
    const keys = [...rows.keys()].sort((a, b) => {
      const [la, wa] = a.split('\u0000');
      const [lb, wb] = b.split('\u0000');
      const ra = rows.get(a)![0]!;
      const rb = rows.get(b)![0]!;
      return (
        caseOrder(ra.caseId) - caseOrder(rb.caseId) ||
        la!.localeCompare(lb!) ||
        ra.windowMs - rb.windowMs ||
        wa!.localeCompare(wb!)
      );
    });
    for (const key of keys) {
      const [label, window] = key.split('\u0000');
      const cells = buckets.map(bucket => cellText(summarize(rows.get(key)!.filter(r => r.bucket === bucket))));
      out.push(`| ${label} | ${window} | ${cells.join(' | ')} |`);
    }
    out.push('');
  }
  return out;
}

function flags(records: RunRecord[]): string[] {
  const out: string[] = [];
  const rows = groupBy(records, r => `${rowLabel(r)} ${r.window} @ ${r.bucket}`);
  for (const [label, rs] of rows) {
    const cell = summarize(rs)!;
    const reasons: string[] = [];
    if (cell.failures.length) reasons.push(`failed: ${cell.failures.join('/')}`);
    if (cell.warmMedianMs > BUDGET.timeoutMs) reasons.push(`warm median ${fmtMs(cell.warmMedianMs)} > 15 s`);
    else if (cell.warmMaxMs > BUDGET.timeoutMs) reasons.push(`warm max ${fmtMs(cell.warmMaxMs)} > 15 s`);
    if (cell.coldMs !== null && cell.coldMs > BUDGET.timeoutMs) reasons.push(`cold ${fmtMs(cell.coldMs)} > 15 s`);
    if (cell.peakMemory > BUDGET.hardMemory) reasons.push(`memory ${fmtMem(cell.peakMemory)} > 4 GiB`);
    else if (cell.peakMemory > BUDGET.comfortableMemory) reasons.push(`memory ${fmtMem(cell.peakMemory)} > 1 GiB`);
    if (reasons.length) out.push(`- **${label}**: ${reasons.join('; ')}`);
  }
  return out.length ? out : ['- None.'];
}

function scaling(records: RunRecord[]): string[] {
  const out = ['| case | window | latency slope | read-bytes slope | projects |', '|---|---|---|---|---|'];
  const rows = groupBy(
    records.filter(r => r.ok && !r.cold),
    r => `${rowLabel(r)}\u0000${r.window}`,
  );
  for (const [key, rs] of rows) {
    const perProject = [...groupBy(rs, r => r.hash).values()].map(p => ({
      traces: p[0]!.traces30d,
      ms: median(p.map(r => r.metrics.durationMs)),
      bytes: median(p.map(r => r.metrics.readBytes)),
    }));
    const latency = logLogSlope(perProject.map(p => [p.traces, p.ms]));
    if (latency === null) continue;
    const bytes = logLogSlope(perProject.map(p => [p.traces, p.bytes]));
    const [label, window] = key.split('\u0000');
    out.push(
      `| ${label} | ${window} | ${latency.toFixed(2)} | ${bytes === null ? '–' : bytes.toFixed(2)} | ${perProject.length} |`,
    );
  }
  return out.length > 2 ? out : ['Not enough distinct project sizes yet.'];
}

/** Ratio of variant to base (warm medians) per case/window/bucket. */
function comparison(
  records: RunRecord[],
  variantOf: (r: RunRecord) => string | null,
  title: string,
  buckets: Bucket[],
  isAlt: (r: RunRecord) => boolean,
): string[] {
  const pairs = groupBy(
    records.filter(r => r.ok && !r.cold && variantOf(r) !== null),
    r => `${variantOf(r)}\u0000${r.window}`,
  );
  const out = [
    `#### ${title}`,
    '',
    `| case | window | ${buckets.join(' | ')} |`,
    `|---|---|${buckets.map(() => '---').join('|')}|`,
  ];
  let any = false;
  for (const [key, rs] of pairs) {
    const [label, window] = key.split('\u0000');
    const cells = buckets.map(bucket => {
      const inBucket = rs.filter(r => r.bucket === bucket);
      const alt = inBucket.filter(isAlt);
      // Variants may run on the representative project only; compare like with like.
      const hashes = new Set(alt.map(r => r.hash));
      const base = inBucket.filter(
        r => r.variant === 'base' && (r.stage === 'main' || r.stage === 'payload') && hashes.has(r.hash),
      );
      if (!base.length || !alt.length) return '–';
      const t = median(alt.map(r => r.metrics.durationMs)) / median(base.map(r => r.metrics.durationMs));
      const b = median(alt.map(r => r.metrics.readBytes)) / Math.max(1, median(base.map(r => r.metrics.readBytes)));
      const peak = (xs: RunRecord[]) => Math.max(1, ...xs.map(r => r.metrics.memoryBytes ?? 0));
      const m = peak(alt) / peak(base);
      return `×${m.toFixed(2)} memory · ×${t.toFixed(2)} time · ×${b.toFixed(2)} bytes`;
    });
    if (cells.every(c => c === '–')) continue;
    any = true;
    out.push(`| ${label} | ${window} | ${cells.join(' | ')} |`);
  }
  return any ? [...out, ''] : [];
}

export function renderReport(records: RunRecord[], memoryRecords: RunRecord[] = []): string {
  const buckets = BUCKETS.filter(b => records.some(r => r.bucket === b));
  const lines: string[] = [
    START,
    '',
    '_Generated by `run.ts report` from `results/runs.jsonl`. Do not edit by hand._',
    '',
  ];

  if (existsSync(PREFLIGHT_FILE)) {
    const pre = JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as {
      version: string;
      queryLog: string;
      tables: Array<{ name: string; sortingKey: string; partitionKey: string; totalRows: number }>;
      skipIndexes: Array<{ table: string; name: string; type: string; expr: string }>;
    };
    lines.push(
      '### Replica',
      '',
      `ClickHouse ${pre.version}; metrics from ${pre.queryLog === 'none' ? 'X-ClickHouse-Summary' : 'system.query_log'}.`,
      '',
    );
    lines.push('| table | sorting key | partition key | rows |', '|---|---|---|---|');
    for (const t of pre.tables)
      lines.push(`| ${t.name} | \`${t.sortingKey}\` | \`${t.partitionKey}\` | ${fmtRows(t.totalRows)} |`);
    lines.push(
      '',
      `Skip indexes: ${pre.skipIndexes.length ? pre.skipIndexes.map(i => `\`${i.table}.${i.name}\` (${i.type} on \`${i.expr}\`)`).join(', ') : 'none'}.`,
      '',
    );
  }

  if (existsSync(PROFILE_FILE)) {
    const profile = JSON.parse(readFileSync(PROFILE_FILE, 'utf8')) as {
      anchorTo: string;
      distribution: {
        projects: number;
        p25: number;
        p75: number;
        p50: number;
        p90: number;
        p99: number;
        max: number;
        nullProjectTraces: number;
      };
      projects: Array<{
        bucket: string;
        hash: string;
        traces30d: number;
        spans30d: number | null;
        threads30d: number | null;
        users30d: number | null;
        tokenRows30d: number | null;
      }>;
    };
    const d = profile.distribution;
    lines.push('### Project size profile (last 30 days, traces per project)', '');
    lines.push(
      `${d.projects} projects. p25 ${fmtRows(d.p25)}, p50 ${fmtRows(d.p50)}, p75 ${fmtRows(d.p75)}, p90 ${fmtRows(d.p90)}, p99 ${fmtRows(d.p99)}, max ${fmtRows(d.max)}. Windows end at ${profile.anchorTo}.`,
      '',
    );
    lines.push('| bucket | project | traces | spans | threads | users | token rows |', '|---|---|---|---|---|---|---|');
    const n = (v: number | null) => (v === null ? '–' : `~${fmtRows(v)}`);
    for (const p of profile.projects)
      lines.push(
        `| ${p.bucket} | \`${p.hash}\` | ${n(p.traces30d)} | ${n(p.spans30d)} | ${n(p.threads30d)} | ${n(p.users30d)} | ${n(p.tokenRows30d)} |`,
      );
    lines.push('');
  }

  lines.push(
    '### Results',
    '',
    'Cells: warm median / warm max (cold) latency, then median read rows · read bytes · peak memory across the bucket. `✗` marks limit or error categories.',
    '',
  );
  lines.push(...groupTables(records, buckets));
  lines.push('### Budget flags (15 s timeout, 1 GiB comfortable / 4 GiB hard memory)', '', ...flags(records), '');
  lines.push('### Scaling with project size (log-log slope vs 30-day trace count)', '', ...scaling(records), '');
  lines.push('### Variant comparisons (variant ÷ as-compiled, warm medians)', '');
  lines.push(
    ...comparison(
      records,
      r => (['P1', 'P2', 'P3'].includes(r.caseId) ? r.caseId : null),
      '`quantileExact` vs `quantileDeterministic`',
      buckets,
      r => r.variant === 'exact',
    ),
    ...comparison(
      records,
      r => (['C1', 'C2', 'C3'].includes(r.caseId) ? r.caseId : null),
      '`uniq` vs `uniqExact`',
      buckets,
      r => r.variant === 'uniq',
    ),
    ...comparison(
      records,
      r => (['F0', 'F1', 'E4'].includes(r.caseId) && r.stage === 'main' ? r.caseId : null),
      'W1: tenant-scoped `current_roots` re-read vs as compiled',
      buckets,
      r => r.variant === 'w1',
    ),
    ...comparison(
      records,
      r => (['E4', 'T1', 'T3'].includes(r.caseId) ? r.caseId : null),
      'mkey: dedupe token metrics on `metricId` alone vs `(traceId, metricId)`',
      buckets,
      r => r.variant === 'mkey',
    ),
    ...comparison(
      records,
      r => (r.caseId === 'E4' ? r.caseId : null),
      't2: `max_threads = 2` vs 4',
      buckets,
      r => r.variant === 't2',
    ),
    ...comparison(
      records,
      r => (r.caseId === 'E4' ? r.caseId : null),
      'spill: external GROUP BY / sort above 256 MiB vs in-memory',
      buckets,
      r => r.variant === 'spill',
    ),
    ...comparison(
      records,
      r => (r.group === 'baseline' && r.stage !== 'main' ? r.caseId : null),
      'Payload stage: org/project-scoped vs as compiled',
      buckets,
      r => r.stage === 'payload-scoped',
    ),
  );
  if (memoryRecords.length) {
    const memBuckets = BUCKETS.filter(b => memoryRecords.some(r => r.bucket === b));
    const main = (r: RunRecord) => (r.stage === 'main' ? r.caseId : null);
    lines.push(
      '### Memory reduction, same-session base (`results/memory.jsonl`)',
      '',
      ...comparison(
        memoryRecords,
        main,
        'W1: tenant-scoped `current_roots` re-read',
        memBuckets,
        r => r.variant === 'w1',
      ),
      ...comparison(memoryRecords, main, 't2: `max_threads = 2` vs 4', memBuckets, r => r.variant === 't2'),
      ...comparison(
        memoryRecords,
        main,
        'spill: external GROUP BY / sort above 256 MiB',
        memBuckets,
        r => r.variant === 'spill',
      ),
      ...(
        [
          ['nocm', 'nocm (diagnostic): skip the `costMetadata` parse'],
          ['nodedupe', 'nodedupe (diagnostic): no `(traceId, metricId)` retry dedupe'],
          ['final', 'final: `FINAL` read instead of the GROUP BY dedupe'],
        ] as const
      ).flatMap(([variant, title]) => comparison(memoryRecords, main, title, memBuckets, r => r.variant === variant)),
    );
  }
  lines.push(END);
  return lines.join('\n');
}

export function writeReport(): void {
  const generated = renderReport(readRecords(), readRecords(MEMORY_FILE));
  const current = existsSync(FINDINGS_FILE) ? readFileSync(FINDINGS_FILE, 'utf8') : `# Findings\n\n${START}\n${END}\n`;
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1) throw new Error('FINDINGS.md is missing the report markers');
  writeFileSync(FINDINGS_FILE, `${current.slice(0, start)}${generated}${current.slice(end + END.length)}`);
  process.stdout.write('FINDINGS.md generated section updated\n');
}

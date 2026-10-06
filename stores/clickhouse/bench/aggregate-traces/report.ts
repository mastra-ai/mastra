/**
 * Turns results/*.jsonl (+ preflight/profile summaries) into the generated section of FINDINGS.md.
 * Hand-written prose outside the `report:start` / `report:end` markers is preserved.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUCKETS } from '../shared/profile';
import type { Bucket } from '../shared/profile';
import { BUDGET, fmtBytes, fmtMem, fmtMs, fmtRows, groupBy, logLogSlope, median } from '../shared/report-kit';
import { CASES } from './cases';
import { PREFLIGHT_FILE, PROFILE_FILE, readRecords } from './run';
import type { RunRecord } from './run';

export const FINDINGS_FILE = join(import.meta.dirname, 'FINDINGS.md');
const START = '<!-- report:start -->';
const END = '<!-- report:end -->';

export { BUDGET, logLogSlope, median };

const GROUP_TITLES: Record<string, string> = {
  canonical: 'Canonical decision-doc examples',
  highcard: 'High-cardinality groupBy',
  interval: 'Interval path at the bucket cap',
  pushdown: 'Pushed-down vs non-pushed `where`',
  distinct: 'countDistinct',
  percentile: 'Percentiles',
  baseline: '`queryTraces()` baseline (same selection)',
};

export interface Cell {
  warmMedianMs: number;
  warmMaxMs: number;
  coldMs: number | null;
  readRows: number;
  readBytes: number;
  peakMemory: number;
  failures: string[];
  runs: number;
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
  };
}

function cellText(cell: Cell | null): string {
  if (!cell) return '–';
  if (!Number.isFinite(cell.warmMedianMs)) return `✗ ${cell.failures.join('/')}`;
  const fail = cell.failures.length ? ` ✗${cell.failures.join('/')}` : '';
  const cold = cell.coldMs === null ? '' : ` (cold ${fmtMs(cell.coldMs)})`;
  return `${fmtMs(cell.warmMedianMs)} / ${fmtMs(cell.warmMaxMs)}${cold}<br>${fmtRows(cell.readRows)} rows · ${fmtBytes(cell.readBytes)} · ${fmtMem(cell.peakMemory)}${fail}`;
}

export function rowLabel(r: Pick<RunRecord, 'caseId' | 'variant' | 'stage'>): string {
  return `${r.caseId}${r.variant === 'base' ? '' : `-${r.variant}`}${r.stage === 'main' ? '' : ` ${r.stage}`}`;
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
      const base = inBucket.filter(r => r.variant === 'base' && (r.stage === 'main' || r.stage === 'payload'));
      const alt = inBucket.filter(r => r.variant !== 'base' || r.stage === 'payload-scoped');
      if (!base.length || !alt.length) return '–';
      const t = median(alt.map(r => r.metrics.durationMs)) / median(base.map(r => r.metrics.durationMs));
      const b = median(alt.map(r => r.metrics.readBytes)) / Math.max(1, median(base.map(r => r.metrics.readBytes)));
      return `×${t.toFixed(2)} time · ×${b.toFixed(2)} bytes`;
    });
    if (cells.every(c => c === '–')) continue;
    any = true;
    out.push(`| ${label} | ${window} | ${cells.join(' | ')} |`);
  }
  return any ? [...out, ''] : [];
}

export function renderReport(records: RunRecord[]): string {
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
    ),
    ...comparison(
      records,
      r => (['C1', 'C2', 'C3'].includes(r.caseId) ? r.caseId : null),
      '`uniq` vs `uniqExact`',
      buckets,
    ),
    ...comparison(
      records,
      r => (['F0', 'F1'].includes(r.caseId) ? r.caseId : null),
      'W1: tenant-scoped `current_roots` re-read vs as compiled',
      buckets,
    ),
    ...comparison(
      records,
      r => (r.group === 'baseline' && r.stage !== 'main' ? r.caseId : null),
      'Payload stage: org/project-scoped vs as compiled',
      buckets,
    ),
  );
  lines.push(END);
  return lines.join('\n');
}

export function writeReport(): void {
  const generated = renderReport(readRecords());
  const current = existsSync(FINDINGS_FILE) ? readFileSync(FINDINGS_FILE, 'utf8') : `# Findings\n\n${START}\n${END}\n`;
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1) throw new Error('FINDINGS.md is missing the report markers');
  writeFileSync(FINDINGS_FILE, `${current.slice(0, start)}${generated}${current.slice(end + END.length)}`);
  process.stdout.write('FINDINGS.md generated section updated\n');
}

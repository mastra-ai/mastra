/** Statistics, formatters and budgets shared by every suite's report. */

export const BUDGET = { timeoutMs: 15_000, hardTimeoutMs: 30_000, comfortableMemory: 2 ** 30, hardMemory: 4 * 2 ** 30 };

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Nearest-rank quantile (q in [0, 1]). */
export function quantile(values: number[], q: number): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]!;
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

export const fmtMs = (ms: number) =>
  ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
export const fmtBytes = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e3).toFixed(0)} kB`;
export const fmtMem = (b: number) =>
  b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(2)} GiB` : `${(b / 2 ** 20).toFixed(0)} MiB`;
export const fmtRows = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} k` : `${n}`;

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

export const REPORT_START = '<!-- report:start -->';
export const REPORT_END = '<!-- report:end -->';

/** Replaces the generated section between the report markers, preserving hand-written prose. */
export function spliceReport(existing: string | undefined, generated: string, title: string): string {
  const block = `${REPORT_START}\n${generated}\n${REPORT_END}`;
  if (!existing) return `# ${title}\n\n${block}\n`;
  const start = existing.indexOf(REPORT_START);
  const end = existing.indexOf(REPORT_END);
  if (start === -1 || end === -1) return `${existing.trimEnd()}\n\n${block}\n`;
  return `${existing.slice(0, start)}${block}${existing.slice(end + REPORT_END.length)}`;
}

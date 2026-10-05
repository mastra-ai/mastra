/**
 * Story-only fixtures: one day of edge traffic in hourly buckets, shaped like the Requests
 * page data. Deterministic (no Math.random) so stories and visual diffs stay stable.
 * An incident between 4 PM and 7 PM drives a 5xx spike, a latency bump and a 4xx burst.
 */

export type RequestsBucket = {
  time: string;
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  errorRate: number;
  clientErrorRate: number;
  p50: number;
  p95: number;
  p99: number;
  coldStarts: number;
};

const HOURS = 24;
// Window starts at 2 PM so the incident lands early and the overnight dip sits mid-chart.
const START_HOUR = 14;

function hourLabel(h: number) {
  const hour = (START_HOUR + h) % 24;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

/** Smooth daily load curve: peak mid-afternoon, trough around 4 AM. */
function load(h: number) {
  const hour = (START_HOUR + h) % 24;
  return 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(((hour - 15) / 24) * Math.PI * 2));
}

/** Deterministic wobble in [0.85, 1.15]. */
function wobble(h: number, salt: number) {
  return 1 + 0.15 * Math.sin(h * 1.7 + salt);
}

export const requestsByHour: RequestsBucket[] = Array.from({ length: HOURS }, (_, h) => {
  const incident = h >= 2 && h <= 4;
  const authBurst = h >= 12 && h <= 14;
  const total = Math.round(3900 * load(h) * wobble(h, 1));
  const e5xx = Math.round(total * (incident ? 0.08 : 0.004) * wobble(h, 2));
  const e4xx = Math.round(total * (authBurst ? 0.09 : 0.03) * wobble(h, 3));
  const r3xx = Math.round(total * 0.02 * wobble(h, 4));
  const ok = total - e5xx - e4xx - r3xx;
  const p50 = Math.round(620 * (incident ? 1.8 : 1) * wobble(h, 5));
  const p95 = Math.round(p50 * 3.4 * wobble(h, 6));
  return {
    time: hourLabel(h),
    '2xx': ok,
    '3xx': r3xx,
    '4xx': e4xx,
    '5xx': e5xx,
    errorRate: e5xx / total,
    clientErrorRate: e4xx / total,
    p50,
    p95,
    p99: Math.round(p95 * 1.9 * wobble(h, 7)),
    // Environments scale to zero overnight, so cold starts cluster in the quiet hours.
    coldStarts: Math.round((load(h) < 0.55 ? 14 : 4) * wobble(h, 8)),
  };
});

export const ms = (value: number) => (value >= 1000 ? `${+(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`);

export const percent = (value: number) => `${+(value * 100).toFixed(1)}%`;

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const count = (value: number) => compact.format(value);

/** Legend aggregate: sum of a numeric key across points. */
export const sumOf = (key: string) => (points: Record<string, unknown>[]) => ({
  value: count(points.reduce<number>((sum, p) => sum + (typeof p[key] === 'number' ? p[key] : 0), 0)),
});

/** Legend aggregate: mean of a numeric key, formatted. */
export const meanOf = (key: string, format: (v: number) => string) => (points: Record<string, unknown>[]) => {
  const values = points.map(p => p[key]).filter((v): v is number => typeof v === 'number');
  return { value: format(values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1)) };
};

export const statusSeries = [
  { dataKey: '2xx', label: '2xx', color: 'var(--chart-green)', aggregate: sumOf('2xx') },
  { dataKey: '3xx', label: '3xx', color: 'var(--chart-blue)', aggregate: sumOf('3xx') },
  { dataKey: '4xx', label: '4xx', color: 'var(--chart-amber)', aggregate: sumOf('4xx') },
  { dataKey: '5xx', label: '5xx', color: 'var(--chart-red)', aggregate: sumOf('5xx') },
];

export const percentileSeries = [
  { dataKey: 'p50', label: 'P50', color: 'var(--chart-sequential-1)', aggregate: meanOf('p50', ms) },
  { dataKey: 'p95', label: 'P95', color: 'var(--chart-sequential-3)', aggregate: meanOf('p95', ms) },
  { dataKey: 'p99', label: 'P99', color: 'var(--chart-sequential-5)', aggregate: meanOf('p99', ms) },
];

export const errorRateSeries = [
  { dataKey: 'errorRate', label: '5xx rate', color: 'var(--chart-red)', aggregate: meanOf('errorRate', percent) },
  {
    dataKey: 'clientErrorRate',
    label: '4xx rate',
    color: 'var(--chart-amber)',
    aggregate: meanOf('clientErrorRate', percent),
  },
];

export const coldStartSeries = [
  { dataKey: 'coldStarts', label: 'Cold starts', color: 'var(--chart-cyan)', aggregate: sumOf('coldStarts') },
];

export const routes = [
  { method: 'POST', path: '/api/agents/:id/stream', requests: 16_400, errorRate: 0.0075, p95: 6490 },
  { method: 'GET', path: '/web/factory/projects/:id', requests: 9_880, errorRate: 0, p95: 612 },
  { method: 'GET', path: '/web/linear/issues/:id', requests: 7_380, errorRate: 0.142, p95: 2050 },
  { method: 'GET', path: '/api/memory/threads/:id/messages', requests: 5_790, errorRate: 0, p95: 169 },
  { method: 'POST', path: '/api/agents/:id/generate', requests: 5_060, errorRate: 0.0109, p95: 6890 },
  { method: 'POST', path: '/api/workflows/:id/start-async', requests: 3_140, errorRate: 0.0134, p95: 372 },
];

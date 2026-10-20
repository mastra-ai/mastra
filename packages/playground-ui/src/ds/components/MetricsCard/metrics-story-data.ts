/**
 * Story-only fixtures: one day of edge traffic in hourly buckets, shaped like the Requests
 * page data. Deterministic (no Math.random) so stories and visual diffs stay stable.
 * An incident between 4 PM and 7 PM drives a 5xx spike, a latency bump and a 4xx burst.
 */

export type RequestsBucket = {
  time: string;
  /** Bucket start (ms): charts place x-axis labels on round clock times from it. */
  tsMs: number;
  /** All responses in the bucket. */
  total: number;
  /** The same hour one period earlier, for a dashed "previous period" line. */
  prevTotal: number;
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
  /** Average time a cold start took to answer (ms). */
  wakeMs: number;
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
    tsMs: new Date(2026, 9, 1, START_HOUR + h).getTime(),
    total,
    // Last period ran a little lighter and had no incident.
    prevTotal: Math.round(3700 * load(h) * wobble(h, 10)),
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
    /** Average time a cold start took to answer. */
    wakeMs: Math.round(2100 * wobble(h, 9)),
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

/** Volume against the previous period: solid emphasis line, dashed comparison. */
export const requestsVsPreviousSeries = [
  { dataKey: 'total', label: 'Requests', color: 'var(--chart-blue)', emphasis: true, aggregate: sumOf('total') },
  {
    dataKey: 'prevTotal',
    label: 'Previous period',
    color: 'var(--gray-8)',
    dashed: true,
    aggregate: sumOf('prevTotal'),
  },
];

/** Hourly timestamps of the window (ms), for building other hourly fixtures on the same grid. */
export const hourTs = (h: number) => new Date(2026, 9, 1, START_HOUR + h).getTime();

/* ------------------------------------------------------------------ */
/* Routes: a long tail of method + path stats for the Routes card      */
/* ------------------------------------------------------------------ */

export type RouteStat = {
  method: string;
  path: string;
  requests: number;
  /** Count of 4xx and 5xx responses. */
  e4xx: number;
  e5xx: number;
  p50: number;
  p95: number;
  /** Requests x mean latency: the share "Time spent" divides. */
  timeSpentMs: number;
};

const ROUTE_NAMES: Array<[string, string]> = [
  ['POST', '/api/agents/:id/stream'],
  ['GET', '/web/factory/projects/:id'],
  ['GET', '/web/linear/issues/:id'],
  ['GET', '/api/memory/threads/:id/messages'],
  ['POST', '/api/agents/:id/generate'],
  ['POST', '/api/workflows/:id/start-async'],
  ['GET', '/api/agents'],
  ['GET', '/api/workflows/:id/runs'],
  ['POST', '/api/tools/:id/execute'],
  ['GET', '/api/telemetry/traces'],
  ['GET', '/web/factory/projects'],
  ['PATCH', '/api/memory/threads/:id'],
  ['POST', '/api/memory/threads'],
  ['GET', '/api/scores'],
  ['DELETE', '/api/memory/threads/:id'],
  ['GET', '/api/logs'],
  ['POST', '/api/vector/:index/query'],
  ['GET', '/web/settings'],
  ['POST', '/api/webhooks/github'],
  ['GET', '/health'],
  ['POST', '/api/mcp/:server/tools/:tool'],
  ['GET', '/api/agents/:id/voice/speakers'],
  ['PUT', '/api/workflows/:id/resume'],
  ['GET', '/api/networks'],
];

export const routeStats: RouteStat[] = ROUTE_NAMES.map(([method, path], i) => {
  const requests = Math.max(3, Math.round(16_400 / Math.pow(i + 1, 1.15)));
  const p50 = Math.round(((i * 37) % 9) * 140 + 60);
  const p95 = Math.round(p50 * (2.4 + (i % 4) * 0.6));
  const e5xx = i === 2 ? Math.round(requests * 0.142) : i % 5 === 4 ? Math.round(requests * 0.012) : 0;
  return {
    method,
    path,
    requests,
    e4xx: Math.round(requests * (i % 3 === 0 ? 0.04 : 0.01)),
    e5xx,
    p50,
    p95,
    timeSpentMs: requests * Math.round((p50 + p95) / 2),
  };
});

/* ------------------------------------------------------------------ */
/* Agent activity: the Metrics page (tokens, runs, latency, scores)    */
/* ------------------------------------------------------------------ */

const wave = (h: number, salt: number) => 1 + 0.18 * Math.sin(h * 1.3 + salt);

export const agentActivityByHour = Array.from({ length: HOURS }, (_, h) => {
  const input = Math.round(1_250_000 * load(h) * wave(h, 1));
  const completed = Math.round(6 * load(h) * wave(h, 5));
  const failed = h === 3 || h === 4 || h === 17 ? 2 : h % 7 === 0 ? 1 : 0;
  const p50 = Math.round(2400 * wave(h, 6));
  const p95 = Math.round(9800 * wave(h, 7) * (h === 3 ? 1.6 : 1));
  return {
    time: hourLabel(h),
    tsMs: hourTs(h),
    input,
    output: Math.round(input * 0.09 * wave(h, 2)),
    cacheRead: Math.round(input * 0.55 * wave(h, 3)),
    cost: +(1.25 * load(h) * wave(h, 4)).toFixed(2),
    completed,
    failed,
    failureRate: failed / Math.max(completed + failed, 1),
    p50,
    p95,
    wfP50: Math.round(p50 * 2.1 * wobble(h, 1)),
    wfP95: Math.round(p95 * 1.7 * wobble(h, 2)),
    toolP50: Math.round(180 * wobble(h, 3)),
    toolP95: Math.round(940 * wobble(h, 4) * (h === 3 || h === 4 ? 2.4 : 1)),
    relevancy: +Math.min(0.97, 0.86 * wobble(h, 5)).toFixed(3),
    faithfulness: +(0.78 * wobble(h, 6) - (h === 3 || h === 4 ? 0.12 : 0)).toFixed(3),
    tone: +Math.min(0.99, 0.93 * wobble(h, 7)).toFixed(3),
  };
});

export type AgentActivityBucket = (typeof agentActivityByHour)[number];

export const usd = (value: number) => (value < 0.01 && value > 0 ? '<$0.01' : `$${value.toFixed(2)}`);

/** Runs (or calls, for tools) per entity: completed and errored. */
export const traceVolume: Record<'agents' | 'workflows' | 'tools', { label: string; runs: number; errors: number }[]> =
  {
    agents: [
      { label: 'Code Agent', runs: 102, errors: 6 },
      { label: 'Observer', runs: 22, errors: 1 },
      { label: 'Research Supervisor', runs: 14, errors: 2 },
      { label: 'Billing Agent', runs: 6, errors: 0 },
      { label: 'Content Moderation Assistant', runs: 3, errors: 0 },
    ],
    workflows: [
      { label: 'release-notes', runs: 15, errors: 1 },
      { label: 'document-ingest', runs: 9, errors: 0 },
      { label: 'weekly-report', runs: 6, errors: 2 },
    ],
    tools: [
      { label: 'search_docs', runs: 415, errors: 3 },
      { label: 'read_file', runs: 388, errors: 0 },
      { label: 'run_command', runs: 221, errors: 17 },
      { label: 'fetch_url', runs: 104, errors: 8 },
      { label: 'create_issue', runs: 11, errors: 0 },
      { label: 'list_dir', runs: 64, errors: 0 },
      { label: 'write_file', runs: 42, errors: 1 },
      { label: 'send_email', runs: 20, errors: 2 },
      { label: 'query_db', runs: 9, errors: 0 },
    ],
  };

/** Spend per agent, model and thread, with tokens. */
export const usageBy: Record<'agents' | 'models' | 'threads', { label: string; cost: number; tokens: number }[]> = {
  agents: [
    { label: 'Code Agent', cost: 27.92, tokens: 37_500_000 },
    { label: 'Observer', cost: 1.06, tokens: 1_890_000 },
    { label: 'Research Supervisor', cost: 0.71, tokens: 1_260_000 },
    { label: 'Billing Agent', cost: 0.22, tokens: 470_000 },
    { label: 'Content Moderation Assistant', cost: 0.11, tokens: 301_000 },
  ],
  models: [
    { label: 'claude-opus-5-5', cost: 29.84, tokens: 55_700_000 },
    { label: 'deepseek-v4-flash', cost: 0.12, tokens: 14_300_000 },
    { label: 'deepseek-flash', cost: 0.06, tokens: 1_900_000 },
    { label: 'deepseek-v4-flash-0731', cost: 0.004, tokens: 39_300 },
  ],
  threads: [
    { label: '55399b…6028', cost: 5.12, tokens: 3_980_000 },
    { label: '27581b…df9e', cost: 4.87, tokens: 3_540_000 },
    { label: '8f7b3b…adf7', cost: 3.27, tokens: 3_700_000 },
    { label: 'c1820b…806f', cost: 2.52, tokens: 1_440_000 },
    { label: 'c51f16…8a90', cost: 2.25, tokens: 2_900_000 },
  ],
};

/**
 * Seeds ~60 days of observability history (traces, metrics, scores, logs) straight into the
 * DuckDB file so the traces explorer and the metrics dashboards have something to show over time.
 *
 * It clones real runs captured from this project: each template bundle is an agent trace plus the
 * scorer traces, metrics, scores and logs that point at it. Every clone gets fresh ids, is moved to
 * a new start time, has its durations and token counts scaled, a city swapped in the prompt, and
 * sometimes an error. Volume grows over the window, dips on weekends, peaks in working hours, and
 * there is one incident (days 38–36 ago) with a high error rate.
 *
 * Export the templates once while `mastra dev` runs (see the bottom of this comment), then stop
 * `mastra dev` — DuckDB allows one writer — and run:
 *
 *   npx tsx src/seed-history-traces.ts <templates.json> [runs] [days]   (defaults: 900 runs, 60 days)
 *
 * templates.json is an array of { spans, metrics, scores, logs }, built from
 * GET /api/observability/traces/:traceId, /metrics, /scores and /logs.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DuckDBStore } from '@mastra/duckdb';

type Row = Record<string, any>;
type Bundle = { spans: Row[]; metrics: Row[]; scores: Row[]; logs: Row[] };

const DB_PATH = fileURLToPath(new URL('./mastra/public/mastra-observability.duckdb', import.meta.url));
const DAY = 86_400_000;

const [templatesPath, runsArg, daysArg] = process.argv.slice(2);
if (!templatesPath) throw new Error('Usage: npx tsx src/seed-history-traces.ts <templates.json> [runs] [days]');
const templates: Bundle[] = JSON.parse(readFileSync(templatesPath, 'utf8'));
const runs = Number.parseInt(runsArg ?? '900', 10);
const days = Number.parseInt(daysArg ?? '60', 10);
const now = Date.now();

const CITIES = ['Paris', 'London', 'Tokyo', 'Lyon', 'Berlin', 'Madrid', 'Montreal', 'Lisbon', 'Rome', 'Oslo', 'Seoul'];
const ERRORS = [
  'Upstream model provider timed out after 30000ms',
  'Rate limit exceeded for gpt-5-mini, retry after 20s',
  'Tool weatherInfo failed: geocoding API returned 503',
];
const ISO_DATE = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g;
const IDS = /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}|[0-9a-f]{16})\b/g;
const DATE_FIELDS = ['startedAt', 'endedAt', 'timestamp'];
const DB_FIELDS = ['createdAt', 'updatedAt', 'status'];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;
const gaussian = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

const freshId = (id: string) => (id.includes('-') ? randomUUID() : randomBytes(id.length / 2).toString('hex'));

/** Start times: more traffic as the window gets closer to today, less on weekends, peaking mid-afternoon. */
function startTimes(): number[] {
  const weights = Array.from({ length: days }, (_, i) => {
    const dayStart = now - (days - i) * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.45 : 1;
    return (0.35 + (0.65 * i) / days) * weekend * (0.8 + Math.random() * 0.4);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  // Largest remainder: floor every day's share, then hand the runs rounding dropped to the days closest to their next run.
  const shares = weights.map(weight => (weight / total) * runs);
  const counts = shares.map(Math.floor);
  const dropped = runs - counts.reduce((sum, count) => sum + count, 0);
  shares
    .map((share, i) => ({ i, remainder: share - counts[i]! }))
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, dropped)
    .forEach(({ i }) => counts[i]!++);
  const times: number[] = [];
  weights.forEach((_, i) => {
    const dayStart = Math.floor((now - (days - i) * DAY) / DAY) * DAY;
    for (let n = 0; n < counts[i]!; n++) {
      const hour = Math.min(23.9, Math.max(0, 14 + gaussian() * 3.5));
      const time = dayStart + hour * 3_600_000 + Math.random() * 60_000;
      if (time < now - 10 * 60_000) times.push(time);
    }
  });
  return times.sort((a, b) => a - b);
}

function cloneBundle(template: Bundle, start: number): Bundle {
  const origin = Math.min(...template.spans.map(span => Date.parse(span.startedAt)));
  const durationScale = Math.exp(gaussian() * 0.45);
  const tokenScale = 0.6 + Math.random() * 1.2;
  const city = pick(CITIES);
  const ids = new Map<string, string>();

  const json = JSON.stringify(template)
    .replace(IDS, id => ids.get(id) ?? ids.set(id, freshId(id)).get(id)!)
    .replace(ISO_DATE, date => new Date(start + (Date.parse(date) - origin) * durationScale).toISOString())
    .replaceAll('Paris', city)
    .replaceAll('paris', city.toLowerCase());
  const bundle: Bundle = JSON.parse(json);

  for (const row of [...bundle.spans, ...bundle.metrics, ...bundle.scores, ...bundle.logs]) {
    for (const field of DB_FIELDS) delete row[field];
    for (const field of DATE_FIELDS) if (typeof row[field] === 'string') row[field] = new Date(row[field]);
  }
  for (const metric of bundle.metrics) {
    const isTokens = metric.name.endsWith('_tokens');
    const scale = isTokens ? tokenScale : durationScale;
    metric.value = Math.round(metric.value * scale);
    // A token count's cost follows the count, so usage and spend keep describing the same work.
    if (isTokens && typeof metric.estimatedCost === 'number') metric.estimatedCost *= tokenScale;
  }
  for (const score of bundle.scores) {
    if (score.scorerId === 'alternating-scorer') score.score = Math.random() < 0.6 ? 1 : 0;
  }
  return bundle;
}

function fail(bundle: Bundle, message: string) {
  const agentRoot = bundle.spans.find(span => span.parentSpanId == null && span.spanType === 'agent_run');
  const generation = bundle.spans.find(span => span.spanType === 'model_generation');
  const error = { message, id: 'AGENT_RUN_FAILED', domain: 'AGENT', category: 'THIRD_PARTY' };
  for (const span of [agentRoot, generation]) {
    if (!span) continue;
    span.error = error;
    span.output = null;
    span.outputPreview = null;
  }
  for (const metric of bundle.metrics) {
    if (metric.labels?.status) metric.labels = { ...metric.labels, status: 'error' };
  }
  for (const score of bundle.scores) score.score = 0;
  bundle.logs.push({
    logId: randomUUID(),
    timestamp: agentRoot?.endedAt ?? new Date(),
    level: 'error',
    message,
    data: { errorId: error.id },
    traceId: agentRoot?.traceId,
    spanId: agentRoot?.spanId,
    entityType: agentRoot?.entityType,
    entityId: agentRoot?.entityId,
    entityName: agentRoot?.entityName,
    environment: 'development',
    serviceName: 'mastra',
  });
}

const incident = { from: now - 38 * DAY, to: now - 36 * DAY };
const all: Bundle = { spans: [], metrics: [], scores: [], logs: [] };
const times = startTimes();
let failures = 0;

for (const start of times) {
  const bundle = cloneBundle(pick(templates), start);
  const errorRate = start >= incident.from && start <= incident.to ? 0.4 : 0.04;
  if (Math.random() < errorRate) {
    fail(bundle, pick(ERRORS));
    failures++;
  }
  all.spans.push(...bundle.spans);
  all.metrics.push(...bundle.metrics);
  all.scores.push(...bundle.scores);
  all.logs.push(...bundle.logs);
}

const BATCH = 2_000;
const store = new DuckDBStore({ path: DB_PATH });
const observability = store.observability;
await observability.init();
for (let i = 0; i < all.spans.length; i += BATCH) {
  await observability.batchCreateSpans({ records: all.spans.slice(i, i + BATCH) as any });
}
for (let i = 0; i < all.metrics.length; i += BATCH) {
  await observability.batchCreateMetrics({ metrics: all.metrics.slice(i, i + BATCH) as any });
}
await observability.batchCreateScores({ scores: all.scores as any });
await observability.batchCreateLogs({ logs: all.logs as any });
await store.close();

console.log(
  `Seeded ${times.length} runs (${failures} failed) over ${days} days: ` +
    `${all.spans.length} spans, ${all.metrics.length} metrics, ${all.scores.length} scores, ${all.logs.length} logs`,
);

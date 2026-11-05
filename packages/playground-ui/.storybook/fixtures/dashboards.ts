import { getResponse, http, HttpResponse } from 'msw';

/**
 * A browser-side Mastra observability API for dashboard stories: the routes a dashboard reads, answered
 * with canned data through the client's `customFetch`, so no service worker is needed.
 */

export const STORY_BASE_URL = 'http://localhost:4111';
const API = `${STORY_BASE_URL}/api/observability`;
const HOUR = 3_600_000;

/** `count` hourly bucket timestamps ending at the current hour. */
const buckets = (count: number) => {
  const now = Math.floor(Date.now() / HOUR) * HOUR;
  return Array.from({ length: count }, (_, i) => new Date(now - (count - 1 - i) * HOUR).toISOString());
};

/** A day of hourly points, a gentle wave peaking at `peak`. */
const day = (peak: number, phase = 0) =>
  buckets(24).map((timestamp, i) => ({
    timestamp,
    value: Math.round(peak * (0.35 + 0.65 * Math.abs(Math.sin((i + phase) / 4)))),
  }));

const capabilities = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    metrics: true,
    logs: true,
    discovery: {
      entityTypes: true,
      entityNames: true,
      serviceNames: true,
      environments: true,
      tags: true,
      metrics: true,
    },
    deltaPolling: true,
    traceQuery: true,
    traceQueryRootDuration: true,
    traceQueryDiscovery: true,
    traceQueryTenantScope: true,
    traceQueryRootSpanFields: true,
    threadQuery: true,
    spanQuery: true,
    feedback: true,
    traceAggregate: true,
    spanAggregate: true,
  },
};

const entityRows = [
  { entityName: 'Support Agent', count: 420, traces: 140, errors: 6, p95: 2_400 },
  { entityName: 'Research Agent', count: 160, traces: 80, errors: 14, p95: 18_000 },
  { entityName: 'Summarizer', count: 60, traces: 30, errors: 0, p95: 1_100 },
].map(r => ({
  dimensions: { entityName: r.entityName },
  measures: {
    count: r.count,
    'countDistinct.traceId': r.traces,
    errorCount: r.errors,
    errorRate: r.errors / r.count,
    'duration.p95': r.p95,
  },
}));

const usageByModel = {
  groups: [
    { dimensions: { provider: 'openai', model: 'gpt-5' }, value: 2_000_000, estimatedCost: 12, costUnit: 'USD' },
    {
      dimensions: { provider: 'anthropic', model: 'claude-haiku-4-5' },
      value: 5_000_000,
      estimatedCost: 4,
      costUnit: 'USD',
    },
  ],
};

const callsByModel = {
  groups: [
    { dimensions: { provider: 'anthropic', model: 'claude-haiku-4-5' }, value: 900 },
    { dimensions: { provider: 'openai', model: 'gpt-5' }, value: 120 },
  ],
};

async function metricOf(request: Request) {
  const body = (await request.json()) as { name?: string | string[]; groupBy?: string[]; aggregation?: string };
  return { name: [body.name].flat()[0] ?? '', groupBy: body.groupBy ?? [], aggregation: body.aggregation ?? '' };
}

const handlers = [
  http.get(`${API}/capabilities`, () => HttpResponse.json(capabilities)),
  http.post(`${API}/metrics/aggregate`, async ({ request }) => {
    const { name, aggregation } = await metricOf(request);
    if (name === 'mastra_agent_duration_ms' && aggregation === 'count')
      return HttpResponse.json({ value: 640, previousValue: 520, changePercent: 23 });
    if (aggregation === 'count_distinct')
      return HttpResponse.json({ value: 85, previousValue: 90, changePercent: -5.5 });
    return HttpResponse.json({ value: 1_250_000, previousValue: 1_000_000, changePercent: 25, estimatedCost: 9.4 });
  }),
  http.post(`${API}/metrics/breakdown`, async ({ request }) => {
    const { groupBy, aggregation } = await metricOf(request);
    if (groupBy.includes('model')) return HttpResponse.json(aggregation === 'count' ? callsByModel : usageByModel);
    if (groupBy.includes('entityName'))
      return HttpResponse.json({
        groups: entityRows.map(r => ({ ...r, value: r.measures.count * 3_000, estimatedCost: r.measures.count / 50 })),
      });
    return HttpResponse.json({ groups: [] });
  }),
  http.post(`${API}/metrics/timeseries`, async ({ request }) => {
    const { name } = await metricOf(request);
    if (name === 'mastra_agent_duration_ms')
      return HttpResponse.json({
        series: [
          { name: 'ok', points: day(30) },
          { name: 'error', points: day(3, 5) },
        ],
      });
    if (name.includes('tokens')) {
      const peak = name.includes('cache') ? 20_000 : name.includes('output') ? 30_000 : 60_000;
      return HttpResponse.json({
        series: [{ name: 'tokens', points: day(peak).map(p => ({ ...p, estimatedCost: p.value / 100_000 })) }],
      });
    }
    return HttpResponse.json({ series: [] });
  }),
  http.post(`${API}/metrics/percentiles`, () =>
    HttpResponse.json({
      series: [
        { percentile: 0.5, points: day(1_200) },
        { percentile: 0.95, points: day(4_500, 2) },
        { percentile: 0.99, points: day(9_800, 4) },
      ],
    }),
  ),
  http.post(`${API}/traces/aggregate`, async ({ request }) => {
    const body = (await request.json()) as { interval?: string; groupBy?: string[] };
    if (body.interval)
      return HttpResponse.json({
        rows: buckets(24).map((bucket, i) => ({
          bucket,
          measures: {
            'countDistinct.resourceId': 3 + (i % 4),
            'countDistinct.threadId': 6 + (i % 7),
            'countDistinct.userId': 2 + (i % 3),
            'countDistinct.sessionId': 4 + (i % 5),
          },
        })),
        truncated: false,
      });
    if (body.groupBy?.length) return HttpResponse.json({ rows: entityRows, truncated: false });
    return HttpResponse.json({
      rows: [
        {
          measures: {
            'countDistinct.resourceId': 12,
            'countDistinct.threadId': 48,
            'countDistinct.userId': 9,
            'countDistinct.sessionId': 30,
          },
        },
      ],
      truncated: false,
    });
  }),
  http.post(`${API}/spans/aggregate`, () => HttpResponse.json({ rows: entityRows, truncated: false })),
  http.get(`${API}/scores`, () =>
    HttpResponse.json({
      pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
      scores: [{ scorerId: 'answer-relevancy', scorerName: 'Answer relevancy', score: 0.84, timestamp: buckets(1)[0] }],
    }),
  ),
  http.post(`${API}/scores/aggregate`, () => HttpResponse.json({ value: 0.84, previousValue: 0.8, changePercent: 5 })),
  http.post(`${API}/scores/timeseries`, () =>
    HttpResponse.json({
      series: [{ name: 'answer-relevancy', points: day(100).map(p => ({ ...p, value: 0.6 + p.value / 400 })) }],
    }),
  ),
];

/** `fetch` for `MastraReactProvider`'s `customFetch`: answers from the handlers above, 404 for anything else. */
export const dashboardStoryFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  return (await getResponse(handlers, request)) ?? HttpResponse.json({ error: 'Not mocked' }, { status: 404 });
};

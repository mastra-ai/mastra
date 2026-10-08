import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { MetricsProvider } from '../../hooks/use-metrics';
import {
  agentLatencyFixture,
  agentRunSeriesFixture,
  agentRunsAggregateFixture,
  agentVolumeBreakdownFixture,
  emptyAggregateFixture,
  emptyBreakdownFixture,
  emptyPercentilesFixture,
  emptyScoresFixture,
  emptySeriesFixture,
  metricsErrorFixture,
  recentScoresFixture,
  scoreAggregateFixture,
  scoreSeriesFixture,
  threadSpendBreakdownFixture,
  tokenSeriesFixture,
} from './fixtures/metrics';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const API = `${TEST_BASE_URL}/api/observability/metrics`;
const SCORES_API = `${TEST_BASE_URL}/api/observability/scores`;

/** The metric a request asks for, and what it groups by. */
async function readMetricRequest(request: Request) {
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) return { name: '', groupBy: [], aggregation: '' };
  // Most queries take a list of metric names; percentiles take one.
  const names = 'name' in body ? [body.name].flat() : [];
  const name = typeof names[0] === 'string' ? names[0] : '';
  const groupBy = 'groupBy' in body && Array.isArray(body.groupBy) ? body.groupBy.map(String) : [];
  const aggregation = 'aggregation' in body ? String(body.aggregation) : '';
  return { name, groupBy, aggregation };
}

/** Seeded data: agent runs, tokens, one agent's volume and latency, and one scorer's results. */
export function seedMetrics() {
  server.use(
    http.post(`${API}/aggregate`, async ({ request }) => {
      // Agent runs count; threads (a distinct count of the same metric) stay empty.
      const { name, aggregation } = await readMetricRequest(request);
      const isAgentRuns = name === 'mastra_agent_duration_ms' && aggregation === 'count';
      return HttpResponse.json(isAgentRuns ? agentRunsAggregateFixture : emptyAggregateFixture);
    }),
    http.post(`${API}/breakdown`, async ({ request }) => {
      const { name, groupBy } = await readMetricRequest(request);
      if (name === 'mastra_agent_duration_ms' && groupBy.includes('status')) {
        return HttpResponse.json(agentVolumeBreakdownFixture);
      }
      if (groupBy.includes('threadId')) return HttpResponse.json(threadSpendBreakdownFixture);
      return HttpResponse.json(emptyBreakdownFixture);
    }),
    http.post(`${API}/timeseries`, async ({ request }) => {
      const { name } = await readMetricRequest(request);
      if (name === 'mastra_agent_duration_ms') return HttpResponse.json(agentRunSeriesFixture());
      if (name === 'mastra_model_total_input_tokens') return HttpResponse.json(tokenSeriesFixture(900, 0.5));
      if (name === 'mastra_model_input_cache_read_tokens') return HttpResponse.json(tokenSeriesFixture(300, 0));
      if (name === 'mastra_model_total_output_tokens') return HttpResponse.json(tokenSeriesFixture(400, 0.25));
      return HttpResponse.json(emptySeriesFixture);
    }),
    http.post(`${API}/percentiles`, async ({ request }) => {
      const { name } = await readMetricRequest(request);
      return HttpResponse.json(name === 'mastra_agent_duration_ms' ? agentLatencyFixture() : emptyPercentilesFixture);
    }),
    http.get(SCORES_API, () => HttpResponse.json(recentScoresFixture())),
    http.post(`${SCORES_API}/aggregate`, () => HttpResponse.json(scoreAggregateFixture)),
    http.post(`${SCORES_API}/timeseries`, () => HttpResponse.json(scoreSeriesFixture())),
  );
}

export function emptyMetrics() {
  server.use(
    http.post(`${API}/aggregate`, () => HttpResponse.json(emptyAggregateFixture)),
    http.post(`${API}/breakdown`, () => HttpResponse.json(emptyBreakdownFixture)),
    http.post(`${API}/timeseries`, () => HttpResponse.json(emptySeriesFixture)),
    http.post(`${API}/percentiles`, () => HttpResponse.json(emptyPercentilesFixture)),
    http.get(SCORES_API, () => HttpResponse.json(emptyScoresFixture)),
  );
}

export function failingMetrics() {
  const fail = () => HttpResponse.json(metricsErrorFixture, { status: 500 });
  server.use(
    http.post(`${API}/aggregate`, fail),
    http.post(`${API}/breakdown`, fail),
    http.post(`${API}/timeseries`, fail),
    http.post(`${API}/percentiles`, fail),
    http.get(SCORES_API, fail),
  );
}

/** Every metrics and scores request stays in flight, so cards show their first-load state. */
export function pendingMetrics() {
  const hang = async () => {
    await delay('infinite');
    return HttpResponse.json({});
  };
  server.use(
    http.post(`${API}/:operation`, hang),
    http.get(SCORES_API, hang),
    http.post(`${SCORES_API}/:operation`, hang),
  );
}

/** Renders a card inside a 24h, unfiltered metrics dashboard. */
export function renderInMetrics(ui: ReactNode) {
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      {ui}
    </MetricsProvider>,
  );
}

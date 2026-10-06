// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsProvider } from '../../hooks/use-metrics';
import { MetricsDashboard } from '../metrics-dashboard';
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
import { TestLinkProvider } from '@/test/link-provider';
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
function useSeededMetrics() {
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

function useEmptyMetrics() {
  server.use(
    http.post(`${API}/aggregate`, () => HttpResponse.json(emptyAggregateFixture)),
    http.post(`${API}/breakdown`, () => HttpResponse.json(emptyBreakdownFixture)),
    http.post(`${API}/timeseries`, () => HttpResponse.json(emptySeriesFixture)),
    http.post(`${API}/percentiles`, () => HttpResponse.json(emptyPercentilesFixture)),
    http.get(SCORES_API, () => HttpResponse.json(emptyScoresFixture)),
  );
}

function useFailingMetrics() {
  const fail = () => HttpResponse.json(metricsErrorFixture, { status: 500 });
  server.use(
    http.post(`${API}/aggregate`, fail),
    http.post(`${API}/breakdown`, fail),
    http.post(`${API}/timeseries`, fail),
    http.post(`${API}/percentiles`, fail),
    http.get(SCORES_API, fail),
  );
}

function renderDashboard() {
  return renderWithProviders(
    <TestLinkProvider>
      <MetricsProvider
        preset="24h"
        filterTokens={[]}
        onPresetChange={() => {}}
        onFilterTokensChange={() => {}}
        tracesBasePath="/orgs/org_1/projects/proj_1/traces"
        logsBasePath="/orgs/org_1/projects/proj_1/logs"
      >
        <MetricsDashboard />
      </MetricsProvider>
    </TestLinkProvider>,
  );
}

describe('MetricsDashboard', () => {
  describe('when the range has data', () => {
    beforeEach(() => {
      useSeededMetrics();
      renderDashboard();
    });

    it('shows each KPI against the previous range', async () => {
      expect(await screen.findByText('693')).toBeDefined();
      expect(screen.getAllByText('vs 891').length).toBeGreaterThan(0);
    });

    it('sums uncached input, cache reads and output in token usage', async () => {
      // 600 + 300 + 400.
      expect(await screen.findByText('1.30K')).toBeDefined();
    });

    it('switches the token chart to cost', async () => {
      expect(await screen.findByText('1.30K')).toBeDefined();
      fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));
      // Input and output carry the cost; cache reads are part of input.
      expect(await screen.findByText('$0.75')).toBeDefined();
      expect(screen.getByText('Estimated model spend.')).toBeDefined();
    });

    it('shows the share of agent runs that failed', async () => {
      // 2 of 10 runs, one `error` and one `failed`.
      expect(await screen.findByText('20.0%')).toBeDefined();
    });

    it('shows the peak P95 latency', async () => {
      expect(await screen.findByText('4.50s')).toBeDefined();
    });

    it('says when a latency view has no runs', async () => {
      expect(await screen.findByText('4.50s')).toBeDefined();
      // Latency comes before trace volume, which has its own Workflows tab.
      const [latencyWorkflows] = screen.getAllByRole('tab', { name: 'Workflows' });
      if (!latencyWorkflows) throw new Error('Latency has no Workflows tab');
      fireEvent.click(latencyWorkflows);
      expect(await screen.findByText('No workflow runs in this range.')).toBeDefined();
    });

    it('lists each agent in trace volume, linked to its traces', async () => {
      const agent = await screen.findByRole('link', { name: /Chef Agent/ });
      expect(agent.getAttribute('href')).toContain('/orgs/org_1/projects/proj_1/traces');
    });

    it('ranks threads by what they spent, linked to their traces', async () => {
      fireEvent.click(await screen.findByRole('tab', { name: 'Threads' }));
      const thread = await screen.findByRole('link', { name: /thread-big/ });
      expect(thread.getAttribute('href')).toContain('filterThreadId=thread-big');
      expect(screen.getByText('$1.25')).toBeDefined();
      expect(screen.getByText('42.0K')).toBeDefined();
    });

    it('charts each scorer found in the recent scores, with its mean over the range', async () => {
      expect(await screen.findByText('Answer relevancy')).toBeDefined();
      expect(screen.getByText('0.84')).toBeDefined();
      expect(screen.getByText('scorer')).toBeDefined();
    });
  });

  describe('when the range is empty', () => {
    it('says so in every card', async () => {
      useEmptyMetrics();
      renderDashboard();

      expect(await screen.findByText('No model calls in this range.')).toBeDefined();
      expect(screen.getAllByText('No agent runs in this range.')).toHaveLength(3);
      expect(screen.getByText('No runs in this range.')).toBeDefined();
      expect(screen.getByText('No model usage in this range.')).toBeDefined();
      expect(screen.getByText('No scores in this range.')).toBeDefined();
    });
  });

  describe('when the metrics API fails', () => {
    beforeEach(() => {
      useFailingMetrics();
      renderDashboard();
    });

    it('shows an error in every chart card instead of an empty state', async () => {
      // Token usage, runs, failure rate, latency, trace volume, usage and scores (after the client's retries).
      await waitFor(
        () => expect(screen.getAllByText("Couldn't load this data. Try again in a moment.")).toHaveLength(7),
        { timeout: 5000 },
      );
      expect(screen.queryByText('No agent runs in this range.')).toBeNull();
    });

    it('says each KPI could not load instead of showing a bare dash', async () => {
      await waitFor(() => expect(screen.getAllByText("Couldn't load")).toHaveLength(4), { timeout: 5000 });
    });
  });
});

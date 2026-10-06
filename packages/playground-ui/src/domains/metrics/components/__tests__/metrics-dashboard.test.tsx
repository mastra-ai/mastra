// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MetricsProvider } from '../../hooks/use-metrics';
import { MemoryCard } from '../memory-card';
import { MetricsDashboard } from '../metrics-dashboard';
import {
  agentLatencyFixture,
  agentRunSeriesFixture,
  agentRunsAggregateFixture,
  agentVolumeBreakdownFixture,
  emptyAggregateFixture,
  emptyBreakdownFixture,
  emptyPercentilesFixture,
  emptySeriesFixture,
  metricsErrorFixture,
  tokenSeriesFixture,
  threadRunsBreakdownFixture,
} from './fixtures/metrics';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const API = `${TEST_BASE_URL}/api/observability/metrics`;

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

/** Seeded data: agent runs, tokens, one agent's volume and its latency. */
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
      if (name === 'mastra_agent_duration_ms' && groupBy.includes('threadId')) {
        return HttpResponse.json(threadRunsBreakdownFixture);
      }
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
  );
}

function useEmptyMetrics() {
  server.use(
    http.post(`${API}/aggregate`, () => HttpResponse.json(emptyAggregateFixture)),
    http.post(`${API}/breakdown`, () => HttpResponse.json(emptyBreakdownFixture)),
    http.post(`${API}/timeseries`, () => HttpResponse.json(emptySeriesFixture)),
    http.post(`${API}/percentiles`, () => HttpResponse.json(emptyPercentilesFixture)),
  );
}

function useFailingMetrics() {
  const fail = () => HttpResponse.json(metricsErrorFixture, { status: 500 });
  server.use(
    http.post(`${API}/aggregate`, fail),
    http.post(`${API}/breakdown`, fail),
    http.post(`${API}/timeseries`, fail),
    http.post(`${API}/percentiles`, fail),
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
        <MetricsDashboard>
          <MemoryCard />
        </MetricsDashboard>
      </MetricsProvider>
    </TestLinkProvider>,
  );
}

describe('MetricsDashboard', () => {
  it('shows the seeded runs, tokens, failure rate, latency and trace volume', async () => {
    useSeededMetrics();
    renderDashboard();

    // KPIs: this range against the previous one.
    expect(await screen.findByText('693')).toBeDefined();
    expect(screen.getAllByText('vs 891').length).toBeGreaterThan(0);
    // Token usage sums uncached input, cache reads and output: 600 + 300 + 400.
    expect(await screen.findByText('1.30K')).toBeDefined();
    // Failure rate: 2 of 10 runs.
    expect(await screen.findByText('20.0%')).toBeDefined();
    // Latency: the peak P95.
    expect(await screen.findByText('4.50s')).toBeDefined();
    // Trace volume lists the agent, linked to its traces.
    const agent = await screen.findByRole('link', { name: /Chef Agent/ });
    expect(agent.getAttribute('href')).toContain('/orgs/org_1/projects/proj_1/traces');
  });

  it('ranks the busiest threads in the Memory card, linked to their traces', async () => {
    useSeededMetrics();
    renderDashboard();

    const thread = await screen.findByRole('link', { name: /thread-1/ });
    expect(thread.getAttribute('href')).toContain('filterThreadId=thread-1');
    expect(thread.getAttribute('href')).toContain('filterResourceId=user-1');
  });

  it('switches the token chart to cost', async () => {
    useSeededMetrics();
    renderDashboard();

    expect(await screen.findByText('1.30K')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));
    // Input and output carry the cost; cache reads are part of input.
    expect(await screen.findByText('$0.75')).toBeDefined();
    expect(screen.getByText('Estimated model spend.')).toBeDefined();
  });

  it('says when a latency view has no runs', async () => {
    useSeededMetrics();
    renderDashboard();

    expect(await screen.findByText('4.50s')).toBeDefined();
    // Latency comes before trace volume, which has its own Workflows tab.
    const [latencyWorkflows] = screen.getAllByRole('tab', { name: 'Workflows' });
    if (!latencyWorkflows) throw new Error('Latency has no Workflows tab');
    fireEvent.click(latencyWorkflows);
    expect(await screen.findByText('No workflow runs in this range.')).toBeDefined();
  });

  it('says when the range has no data', async () => {
    useEmptyMetrics();
    renderDashboard();

    expect(await screen.findByText('No model calls in this range.')).toBeDefined();
    expect(screen.getAllByText('No agent runs in this range.')).toHaveLength(3);
    expect(screen.getByText('No runs in this range.')).toBeDefined();
    expect(screen.getByText('No model usage in this range.')).toBeDefined();
    expect(screen.getByText('No thread activity in this range.')).toBeDefined();
  });

  it('says when the metrics fail to load', async () => {
    useFailingMetrics();
    renderDashboard();

    // Token usage, runs, failure rate, latency, trace volume, usage and memory (after the client's retries).
    await waitFor(
      () => expect(screen.getAllByText("Couldn't load this data. Try again in a moment.")).toHaveLength(7),
      { timeout: 5000 },
    );
    expect(screen.queryByText('No agent runs in this range.')).toBeNull();
  });
});

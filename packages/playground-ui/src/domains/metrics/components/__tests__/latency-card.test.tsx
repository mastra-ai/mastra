// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { LatencyCard } from '../latency-card';
import { agentLatencyFixture, emptyPercentilesFixture } from './fixtures/metrics';
import { PERCENTILES_API, failingMetrics, pendingMetrics, renderInMetrics, seedMetrics } from './metrics-msw';
import { server } from '@/test/msw-server';

/** Serves agent latency and records each percentiles request's metric and levels. */
function recordPercentiles() {
  const requests: { name: string; percentiles: number[] }[] = [];
  server.use(
    http.post(PERCENTILES_API, async ({ request }) => {
      const body = (await request.json()) as { name: string; percentiles: number[] };
      requests.push({ name: body.name, percentiles: body.percentiles });
      return HttpResponse.json(
        body.name === 'mastra_agent_duration_ms' ? agentLatencyFixture() : emptyPercentilesFixture,
      );
    }),
  );
  return requests;
}

describe('LatencyCard', () => {
  describe('when the data is loading', () => {
    it('shows its title and tabs', () => {
      pendingMetrics();
      renderInMetrics(<LatencyCard />);
      expect(screen.getByText('Latency')).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Agents' })).toBeDefined();
      expect(screen.queryByText('4.50s')).toBeNull();
    });
  });

  describe('when agent runs have durations', () => {
    it('shows the peak P95', async () => {
      seedMetrics();
      renderInMetrics(<LatencyCard />);
      expect(await screen.findByText('4.50s')).toBeDefined();
    });

    it('charts P50, P95 and P99', async () => {
      seedMetrics();
      renderInMetrics(<LatencyCard />);
      await screen.findByText('4.50s');
      for (const label of ['P50', 'P95', 'P99']) expect(screen.getByText(label)).toBeDefined();
    });

    it('asks only for the open tab, with P50, P95 and P99', async () => {
      seedMetrics();
      const requests = recordPercentiles();
      renderInMetrics(<LatencyCard />);
      await screen.findByText('4.50s');
      expect(requests).toEqual([{ name: 'mastra_agent_duration_ms', percentiles: [0.5, 0.95, 0.99] }]);
    });

    it('asks for workflows when that tab opens', async () => {
      seedMetrics();
      const requests = recordPercentiles();
      renderInMetrics(<LatencyCard />);
      await screen.findByText('4.50s');
      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      await waitFor(() => expect(requests.map(r => r.name)).toContain('mastra_workflow_duration_ms'));
      expect(requests).toHaveLength(2);
    });

    it('has no "View in traces" button without a handler', async () => {
      seedMetrics();
      renderInMetrics(<LatencyCard />);
      await screen.findByText('4.50s');
      expect(screen.queryByRole('button', { name: 'View in traces' })).toBeNull();
    });

    it('reports the open tab from "View in traces"', async () => {
      seedMetrics();
      const onViewTraces = vi.fn();
      renderInMetrics(<LatencyCard onViewTraces={onViewTraces} />);
      await screen.findByText('4.50s');
      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      fireEvent.click(screen.getByRole('button', { name: 'View in traces' }));
      expect(onViewTraces).toHaveBeenCalledWith(EntityType.WORKFLOW_RUN);
    });
  });

  describe('when the data fails to load', () => {
    it('keeps the tabs and says so', async () => {
      failingMetrics();
      renderInMetrics(<LatencyCard />);
      expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Workflows' })).toBeDefined();
    });
  });
});

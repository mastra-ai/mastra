// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsProvider } from '../../hooks/use-metrics';
import { AgentRunsCard } from '../agent-runs-card';
import { FailureRateCard } from '../failure-rate-card';
import { LatencyCard } from '../latency-card';
import { MetricsKpis } from '../metrics-kpis';
import { ScoresCard } from '../scores-card';
import { TokenUsageCard } from '../token-usage-card';
import { TraceVolumeCard } from '../trace-volume-card';
import { UsageCard } from '../usage-card';
import { emptyMetrics, failingMetrics, seedMetrics } from './metrics-msw';
import { renderWithProviders } from '@/test/render';

const onEntityClick = vi.fn();
const onThreadClick = vi.fn();

function renderDashboard() {
  onEntityClick.mockReset();
  onThreadClick.mockReset();
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      <MetricsKpis />
      <TokenUsageCard />
      <AgentRunsCard />
      <FailureRateCard />
      <LatencyCard />
      <TraceVolumeCard onEntityClick={onEntityClick} />
      <UsageCard onThreadClick={onThreadClick} />
      <ScoresCard />
    </MetricsProvider>,
  );
}

describe('Metrics cards', () => {
  describe('when the range has data', () => {
    beforeEach(() => {
      seedMetrics();
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

    it('lists each agent in trace volume and reports which one was clicked', async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Chef Agent/ }));
      expect(onEntityClick).toHaveBeenCalledWith('agent', 'Chef Agent');
    });

    it('ranks threads by what they spent and reports which one was clicked', async () => {
      fireEvent.click(await screen.findByRole('tab', { name: 'Threads' }));
      fireEvent.click(await screen.findByRole('button', { name: /thread-big/ }));
      expect(onThreadClick).toHaveBeenCalledWith('thread-big');
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
      emptyMetrics();
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
      failingMetrics();
      renderDashboard();
    });

    it('shows an error in every chart card instead of an empty state', async () => {
      // 4 KPIs, then token usage, runs, failure rate, latency, trace volume, usage and scores
      // (after the client's retries), all with the same short message.
      await waitFor(() => expect(screen.getAllByText("Couldn't load")).toHaveLength(11), { timeout: 5000 });
      expect(screen.queryByText('No agent runs in this range.')).toBeNull();
    });

    it('says each KPI could not load instead of showing a bare dash', async () => {
      // The KPIs and the chart cards share the message, so wait for all of them, then count the KPIs' dashes.
      await waitFor(() => expect(screen.getAllByText("Couldn't load")).toHaveLength(11), { timeout: 5000 });
      expect(screen.getAllByText('—')).toHaveLength(4);
    });
  });
});

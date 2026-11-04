// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsProvider } from '../../hooks/use-metrics';
import { AgentRunsCard } from '../agent-runs-card';
import { FailureRateCard } from '../failure-rate-card';
import { LatencyCard } from '../latency-card';
import { ScoresCard } from '../scores-card';
import { TokenUsageCard } from '../token-usage-card';
import { TraceVolumeCard } from '../trace-volume-card';
import { UsageCard } from '../usage-card';
import { emptyMetrics, failingMetrics, pickView, seedMetrics } from './metrics-msw';
import { renderWithProviders } from '@/test/render';

const onEntityClick = vi.fn();
const onThreadClick = vi.fn();

function renderDashboard() {
  onEntityClick.mockReset();
  onThreadClick.mockReset();
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
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

    it('sums uncached input, cache reads and output in token usage', async () => {
      // 600 + 300 + 400.
      expect(await screen.findByText('1.30K')).toBeDefined();
    });

    it('switches the token chart to cost', async () => {
      expect(await screen.findByText('1.30K')).toBeDefined();
      await pickView('Token usage', 'Model cost');
      // Input and output carry the cost; cache reads are part of input.
      expect(await screen.findByText('$0.75')).toBeDefined();
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
      await pickView('Agent latency', 'Workflow latency');
      expect(await screen.findByText('No workflow runs in this range.')).toBeDefined();
    });

    it('lists each agent in trace volume and reports which one was clicked', async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Chef Agent/ }));
      expect(onEntityClick).toHaveBeenCalledWith('agent', 'Chef Agent');
    });

    it('ranks threads by what they spent and reports which one was clicked', async () => {
      await screen.findByRole('button', { name: /Chef Agent/ });
      await pickView('Usage by agent', 'Usage by thread');
      fireEvent.click(await screen.findByRole('button', { name: /thread-big/ }));
      expect(onThreadClick).toHaveBeenCalledWith('thread-big');
      expect(screen.getByText('$1.25')).toBeDefined();
      expect(screen.getByText('42.0K')).toBeDefined();
    });

    it('charts each scorer found in the recent scores', async () => {
      expect(await screen.findByText('Answer relevancy')).toBeDefined();
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
      // Token usage, runs, failure rate, latency, trace volume, usage and scores (after the client's retries).
      await waitFor(
        () => expect(screen.getAllByText("Couldn't load this data. Try again in a moment.")).toHaveLength(7),
        { timeout: 5000 },
      );
      expect(screen.queryByText('No agent runs in this range.')).toBeNull();
    });
  });
});

// @vitest-environment jsdom
import type { ClientScoreRowData, DatasetExperiment } from '@mastra/client-js';
import type { ExperimentItemUsage, ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentKpis } from '../experiment-kpis';
import type { ExperimentKpisProps } from '../experiment-kpis';
import { experimentTotalsUsage } from './fixtures/experiment-item-usage';
import { experiments } from './fixtures/experiments';

// Completed run: 10:00 → 10:05, 10 items.
const completedExperiment: DatasetExperiment = experiments[0];

// Cost and tokens come from the usage prop; the KPIs only read the average duration here.
const fullMetrics: ExperimentMetrics = {
  totalTokens: null,
  estimatedCost: null,
  costUnit: null,
  avgAgentDurationMs: 1850,
  agentRuns: 42,
};

// avg of 0.5, 1 and 1 across both scorers is 0.833.
const scoresByItemId: Record<string, Array<Pick<ClientScoreRowData, 'score'>>> = {
  'item-1': [{ score: 0.5 }],
  'item-2': [{ score: 1 }, { score: 1 }],
};

const renderKpis = (
  experiment: DatasetExperiment,
  metrics?: ExperimentKpisProps['metrics'],
  { usage, isUsageLoading }: { usage?: ExperimentItemUsage; isUsageLoading?: boolean } = {},
) =>
  render(
    <ExperimentKpis
      experiment={experiment}
      metrics={metrics}
      scoresByItemId={scoresByItemId}
      usage={usage}
      isUsageLoading={isUsageLoading}
    />,
  );

describe('ExperimentKpis', () => {
  afterEach(cleanup);

  it('shows the overall average and wall-clock duration of a completed run', () => {
    renderKpis(completedExperiment);

    expect(screen.getByText('0.833')).toBeDefined();
    expect(screen.getByText('across all scorers')).toBeDefined();
    expect(screen.getByText('Run duration')).toBeDefined();
    expect(screen.getByText('5m')).toBeDefined();
  });

  describe('when metrics are enabled', () => {
    const renderWithMetrics = () =>
      renderKpis(
        completedExperiment,
        { data: fullMetrics, isLoading: false, isEnabled: true },
        {
          usage: experimentTotalsUsage,
        },
      );

    it('shows the total cost in fractional cents', () => {
      renderWithMetrics();
      expect(screen.getByText('$0.012')).toBeDefined();
    });

    it('shows the average duration per item under the run duration', () => {
      renderWithMetrics();
      expect(screen.getByText('1.85s avg per item')).toBeDefined();
    });

    it('shows the total token count', () => {
      renderWithMetrics();
      expect(screen.getByText('12,400')).toBeDefined();
    });

    it('splits the total tokens into input and output', () => {
      renderWithMetrics();
      expect(screen.getByText('9,900 in')).toBeDefined();
      expect(screen.getByText('2,500 out')).toBeDefined();
    });

    it('leads with cost, duration and tokens', () => {
      renderWithMetrics();
      const labels = ['Total cost', 'Run duration', 'Total tokens', 'Avg score'].map(label => screen.getByText(label));
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i - 1].compareDocumentPosition(labels[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });

  describe('when metrics are enabled and the run is still in progress', () => {
    const runningExperiment: DatasetExperiment = { ...completedExperiment, status: 'running', completedAt: null };

    it('keeps the cost and token cards loading', () => {
      renderKpis(runningExperiment, { data: fullMetrics, isLoading: false, isEnabled: true });

      expect(screen.getByText('Total cost')).toBeDefined();
      expect(screen.getByText('Total tokens')).toBeDefined();
      expect(screen.queryByText('estimated')).toBeNull();
      expect(screen.queryByText('input + output')).toBeNull();
    });
  });

  describe('when the usage is still loading', () => {
    it('keeps the cost and token cards loading', () => {
      renderKpis(
        completedExperiment,
        { data: fullMetrics, isLoading: false, isEnabled: true },
        { isUsageLoading: true },
      );

      expect(screen.getByText('Total cost')).toBeDefined();
      expect(screen.queryByText('estimated')).toBeNull();
      expect(screen.queryByText('input + output')).toBeNull();
    });
  });

  describe('when metrics are disabled', () => {
    const renderWithoutMetrics = () =>
      renderKpis(completedExperiment, { data: fullMetrics, isLoading: false, isEnabled: false });

    it('hides the cost and token cards', () => {
      renderWithoutMetrics();

      expect(screen.getByText('Avg score')).toBeDefined();
      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();
    });

    it('shows when the run started under the run duration', () => {
      renderWithoutMetrics();

      expect(screen.getByText(/^started /)).toBeDefined();
      expect(screen.queryByText(/avg per item/)).toBeNull();
    });
  });
});

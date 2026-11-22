// @vitest-environment jsdom
import type { DatasetExperiment } from '@mastra/client-js';
import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentKpis } from '../experiment-kpis';
import type { ExperimentKpisProps } from '../experiment-kpis';
import { experimentTotalsUsage } from './fixtures/experiment-item-usage';
import { experimentMetrics } from './fixtures/experiment-metrics';
import { kpiScoresByItemId } from './fixtures/experiment-scores';
import { completedExperiment, runningExperiment } from './fixtures/experiments';

const renderKpis = (
  experiment: DatasetExperiment,
  metrics?: ExperimentKpisProps['metrics'],
  { usage, isUsageLoading }: { usage?: ExperimentItemUsage; isUsageLoading?: boolean } = {},
) =>
  render(
    <ExperimentKpis
      experiment={experiment}
      metrics={metrics}
      scoresByItemId={kpiScoresByItemId}
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
        { data: experimentMetrics, isLoading: false, isEnabled: true },
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
      const labels = screen.getAllByText(/^(Total cost|Run duration|Total tokens|Avg score)$/);
      expect(labels.map(label => label.textContent)).toEqual([
        'Total cost',
        'Run duration',
        'Total tokens',
        'Avg score',
      ]);
    });
  });

  describe('when metrics are enabled and the run is still in progress', () => {
    it('keeps the cost and token cards loading', () => {
      renderKpis(runningExperiment, { data: experimentMetrics, isLoading: false, isEnabled: true });

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
        { data: experimentMetrics, isLoading: false, isEnabled: true },
        { isUsageLoading: true },
      );

      expect(screen.getByText('Total cost')).toBeDefined();
      expect(screen.queryByText('estimated')).toBeNull();
      expect(screen.queryByText('input + output')).toBeNull();
    });
  });

  describe('when metrics are disabled', () => {
    const renderWithoutMetrics = () =>
      renderKpis(completedExperiment, { data: experimentMetrics, isLoading: false, isEnabled: false });

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

// @vitest-environment jsdom
import type { ClientScoreRowData, DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentItemPanelProvider } from '../../context/experiment-item-panel-context';
import { ExperimentResultsSection } from '../experiment-results-section';
import { tracedItemUsage } from './fixtures/experiment-item-usage';
import {
  agentFailedResult,
  agentMarkdownResult,
  agentTracedResult,
  workflowResult,
} from './fixtures/experiment-results';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(cleanup);

const itemScores: Record<string, Array<Pick<ClientScoreRowData, 'scorerId' | 'score' | 'reason'>>> = {
  'item-agent-traced': [{ scorerId: 'accuracy', score: 0.75 }],
};

function renderSection(
  results: DatasetExperimentResult[],
  {
    supportsMetrics = false,
    usageByTraceId,
    scoresByItemId,
    currentItemId,
    onOpenItem = () => {},
    onClose = () => {},
  }: {
    supportsMetrics?: boolean;
    usageByTraceId?: Record<string, ExperimentItemUsage>;
    scoresByItemId?: typeof itemScores;
    currentItemId?: string;
    onOpenItem?: (itemId: string) => void;
    onClose?: () => void;
  } = {},
) {
  return render(
    <TestLinkProvider>
      <ExperimentItemPanelProvider
        experimentId="exp-1"
        datasetId="ds-1"
        results={results}
        isLoadingResults={false}
        currentItemId={currentItemId}
        onOpenItem={onOpenItem}
        onClose={onClose}
      >
        <ExperimentResultsSection
          supportsMetrics={supportsMetrics}
          results={results}
          isLoading={false}
          selectedIds={new Set()}
          onToggleSelect={() => {}}
          onToggleSelectAll={() => {}}
          usageByTraceId={usageByTraceId}
          scoresByItemId={scoresByItemId}
        />
      </ExperimentItemPanelProvider>
    </TestLinkProvider>,
  );
}

describe('ExperimentResultsSection', () => {
  describe('when results include agent output text', () => {
    it('shows the Output column header', () => {
      renderSection([agentMarkdownResult]);
      expect(screen.getByText('Output')).toBeTruthy();
    });
  });

  describe('when a result failed', () => {
    it('shows the Error column header', () => {
      renderSection([agentFailedResult]);
      expect(screen.getByText('Error')).toBeTruthy();
    });
  });

  describe('when no result has output text', () => {
    it('does not show the Output column header', () => {
      renderSection([workflowResult]);
      expect(screen.queryByText('Output')).toBeNull();
    });
  });

  describe('when the run finished without results', () => {
    it('shows the plain empty state', () => {
      renderSection([]);
      expect(screen.getByText('No results yet')).toBeTruthy();
    });
  });

  describe('when no result has an error', () => {
    it('does not show the Error column header', () => {
      renderSection([agentMarkdownResult, workflowResult]);
      expect(screen.queryByText('Error')).toBeNull();
    });
  });

  describe('when a result has start and end times', () => {
    it('shows how long the item took', () => {
      renderSection([agentTracedResult]);
      expect(screen.getByText('Duration')).toBeTruthy();
      expect(screen.getByTestId('result-duration-res-agent-traced').textContent).toBe('2.5s');
    });
  });

  describe('when metrics are not supported', () => {
    it('does not show the Cost and Tokens columns', () => {
      renderSection([agentTracedResult]);
      expect(screen.queryByText('Cost')).toBeNull();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when metrics are supported', () => {
    const usageByTraceId = { 'trace-res-agent-traced': tracedItemUsage };

    it('shows the Cost and Tokens columns', () => {
      renderSection([agentTracedResult], { supportsMetrics: true });
      expect(screen.getByText('Cost')).toBeTruthy();
      expect(screen.getByText('Tokens')).toBeTruthy();
    });

    it('shows the cost of each traced item', () => {
      renderSection([agentTracedResult], { supportsMetrics: true, usageByTraceId });
      expect(screen.getByTestId('result-cost-res-agent-traced').textContent).toBe('$0.002');
    });

    it('shows the input plus output tokens of each traced item', () => {
      renderSection([agentTracedResult], { supportsMetrics: true, usageByTraceId });
      expect(screen.getByTestId('result-tokens-res-agent-traced').textContent).toBe('1,500');
    });

    it('leaves usage empty for items without a trace', () => {
      renderSection([agentTracedResult, workflowResult], { supportsMetrics: true, usageByTraceId });
      expect(screen.getByTestId('result-cost-res-workflow').textContent).toBe('-');
      expect(screen.getByTestId('result-tokens-res-workflow').textContent).toBe('-');
    });
  });

  describe('when results have scores', () => {
    it('adds one column per scorer with each item score', () => {
      renderSection([agentTracedResult], { scoresByItemId: itemScores });
      expect(screen.getByText('accuracy')).toBeTruthy();
      expect(screen.getByText('0.750')).toBeTruthy();
    });
  });

  describe('when a row is clicked', () => {
    it('opens that item', async () => {
      const onOpenItem = vi.fn();
      renderSection([agentTracedResult], { onOpenItem });
      await userEvent.click(screen.getByTestId('result-duration-res-agent-traced'));
      expect(onOpenItem).toHaveBeenCalledWith('item-agent-traced');
    });
  });

  describe('when the open item row is clicked', () => {
    it('closes the item', async () => {
      const onClose = vi.fn();
      renderSection([agentTracedResult], { currentItemId: 'item-agent-traced', onClose });
      await userEvent.click(screen.getByTestId('result-duration-res-agent-traced'));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});

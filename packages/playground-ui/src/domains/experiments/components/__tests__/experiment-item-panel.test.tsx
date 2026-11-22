// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentItemPanelProvider } from '../../context/experiment-item-panel-context';
import { ExperimentItemPanel } from '../experiment-item-panel';
import type { ExperimentItemPanelProps } from '../experiment-item-panel';
import { agentTracedResult, needsReviewResult } from './fixtures/experiment-results';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderPanel = (
  { results = [agentTracedResult], currentItemId }: { results?: DatasetExperimentResult[]; currentItemId?: string },
  props: Partial<ExperimentItemPanelProps> = {},
) =>
  render(
    <TestLinkProvider>
      <ExperimentItemPanelProvider
        experimentId="exp-1"
        datasetId="ds-1"
        results={results}
        isLoadingResults={false}
        currentItemId={currentItemId}
        onOpenItem={() => {}}
        onClose={() => {}}
      >
        <ExperimentItemPanel variant="inline" {...props} />
      </ExperimentItemPanelProvider>
    </TestLinkProvider>,
  );

describe('ExperimentItemPanel', () => {
  describe('when the open item is not among the loaded results', () => {
    it('says no result is loaded for it', () => {
      renderPanel({ currentItemId: 'item-missing' });

      expect(screen.getByText('No loaded result for item "item-missing".')).toBeDefined();
    });
  });

  describe('when the host can flag results for review', () => {
    it('flags the open result', async () => {
      const onFlagForReview = vi.fn(async (_resultId: string) => {});
      renderPanel({ currentItemId: 'item-agent-traced' }, { onFlagForReview });

      fireEvent.click(screen.getByRole('button', { name: 'Request review' }));

      await waitFor(() => expect(onFlagForReview).toHaveBeenCalledWith('res-agent-traced'));
    });
  });

  describe('when flagging the result fails', () => {
    it('shows an error toast', async () => {
      const toastError = vi.spyOn(toast, 'error');
      renderPanel(
        { currentItemId: 'item-agent-traced' },
        {
          onFlagForReview: async () => {
            throw new Error('boom');
          },
        },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Request review' }));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith('Failed to flag result for review', expect.anything()),
      );
    });
  });

  describe('when the host can complete reviews', () => {
    it('marks the open result as reviewed', async () => {
      const onComplete = vi.fn(async (_resultId: string) => {});
      renderPanel({ results: [needsReviewResult], currentItemId: 'item-agent-traced' }, { onComplete });

      fireEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));

      await waitFor(() => expect(onComplete).toHaveBeenCalledWith('res-agent-traced'));
    });
  });

  describe('when the host cannot change review status', () => {
    it('offers no review actions', () => {
      renderPanel({ results: [needsReviewResult], currentItemId: 'item-agent-traced' });

      expect(screen.queryByRole('button', { name: 'Request review' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull();
    });
  });
});

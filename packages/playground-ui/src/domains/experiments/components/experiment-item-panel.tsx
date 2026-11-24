'use client';

import type { ClientScoreRowData } from '@mastra/client-js';
import { useExperimentItemPanel } from '../context/experiment-item-panel-context';
import { useExperimentResultDetailState } from '../hooks/use-experiment-result-detail-state';
import { ExperimentResultDetail } from './experiment-result-detail';
import type { ExperimentResultDetailProps } from './experiment-result-detail';
import { DataPanel } from '@/ds/components/DataPanel';
import { toast } from '@/utils/toast';

export type ExperimentItemPanelProps = Pick<
  ExperimentResultDetailProps,
  'variant' | 'tracePanel' | 'feedbackTabSlot' | 'feedbackCount' | 'usage' | 'isUsageLoading'
> & {
  /** Scores of the experiment grouped by item id. */
  scoresByItemId?: Record<string, ClientScoreRowData[]>;
  /** Sets the result's review status to `needs-review`. Omit to hide the action. */
  onFlagForReview?: (resultId: string) => Promise<void>;
  /** Sets the result's review status to `complete`. Omit to hide the action. */
  onComplete?: (resultId: string) => Promise<void>;
};

/**
 * Detail of the open item of an `ExperimentItemPanelProvider`. As a drawer, keep it mounted so it
 * animates in and out; the open item drives `open`. Inline, it renders only while an item is open.
 */
export function ExperimentItemPanel({
  scoresByItemId,
  onFlagForReview,
  onComplete,
  ...detailProps
}: ExperimentItemPanelProps) {
  const {
    currentItemId: itemId,
    results,
    isLoadingResults,
    hasNextPage,
    close,
    goToPreviousItem,
    goToNextItem,
  } = useExperimentItemPanel();

  const result = itemId ? results.find(r => r.itemId === itemId) : undefined;
  const resultScores = result ? scoresByItemId?.[result.itemId] : undefined;
  const detailState = useExperimentResultDetailState(resultScores, result?.id);

  const flagForReview = async (resultId: string) => {
    if (!onFlagForReview) return;
    try {
      await onFlagForReview(resultId);
      toast('Result flagged for review');
    } catch {
      toast.error('Failed to flag result for review');
    }
  };
  const completeResult = async (resultId: string) => {
    if (!onComplete) return;
    try {
      await onComplete(resultId);
      toast('Result marked as reviewed');
    } catch {
      toast.error('Failed to complete result');
    }
  };

  return (
    <ExperimentResultDetail
      {...detailProps}
      result={result}
      itemId={itemId}
      fallback={
        isLoadingResults || hasNextPage ? (
          <DataPanel.LoadingData />
        ) : (
          <DataPanel.NoData>No loaded result for item "{itemId}".</DataPanel.NoData>
        )
      }
      scores={resultScores}
      state={detailState}
      onPrevious={goToPreviousItem}
      onNext={goToNextItem}
      onClose={close}
      onComplete={result && onComplete ? () => completeResult(result.id) : undefined}
      onFlagForReview={result && onFlagForReview ? () => void flagForReview(result.id) : undefined}
    />
  );
}

import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCallback, useMemo } from 'react';

import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { ExperimentResultDetail } from '@/domains/experiments/components/experiment-result-detail';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { useExperimentResultDetailState } from '@/domains/experiments/hooks/use-experiment-result-detail-state';
import { useExperimentTagVocabulary } from '@/domains/experiments/hooks/use-experiment-tag-vocabulary';

/**
 * Result drawer for the `items/:itemId` child route. Always mounted by the
 * experiment page so the drawer animates in and out; `currentItemId` drives `open`.
 */
export function ExperimentItemPanel() {
  const {
    currentItemId: itemId,
    experimentId,
    datasetId,
    experimentStatus,
    results,
    isLoadingResults,
    hasNextPage,
    close,
    goToPreviousItem,
    goToNextItem,
  } = useExperimentItemPanel();

  const result = useMemo(() => (itemId ? results.find(r => r.itemId === itemId) : undefined), [results, itemId]);

  const { data: scoresByItemId } = useScoresByExperimentId(experimentId, experimentStatus);
  const { updateExperimentResult } = useDatasetMutations();

  const flagForReview = useCallback(
    async (resultId: string) => {
      try {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'needs-review' });
        toast('Result flagged for review');
      } catch {
        toast.error('Failed to flag result for review');
      }
    },
    [datasetId, experimentId, updateExperimentResult],
  );
  const tagVocabulary = useExperimentTagVocabulary(datasetId, results);

  const updateTags = useCallback(
    async (resultId: string, tags: string[]) => {
      try {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, tags });
      } catch {
        toast.error('Failed to update tags');
      }
    },
    [datasetId, experimentId, updateExperimentResult],
  );
  const completeResult = useCallback(
    async (resultId: string) => {
      try {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'complete' });
        toast('Result marked as reviewed');
      } catch {
        toast.error('Failed to complete result');
      }
    },
    [datasetId, experimentId, updateExperimentResult],
  );

  const resultScores = result ? scoresByItemId?.[result.itemId] : undefined;
  const detailState = useExperimentResultDetailState(resultScores, result?.id);

  return (
    <ExperimentResultDetail
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
      onComplete={result ? () => completeResult(result.id) : undefined}
      onFlagForReview={result ? () => void flagForReview(result.id) : undefined}
      onTagsChange={result ? tags => void updateTags(result.id, tags) : undefined}
      tagVocabulary={tagVocabulary}
      isUpdatingTags={updateExperimentResult.isPending}
    />
  );
}

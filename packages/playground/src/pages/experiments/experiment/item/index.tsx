import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlayCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { RouteItemOverlay } from '@/components/route-item-overlay';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { ExperimentResultDetail } from '@/domains/experiments/components/experiment-result-detail';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { useExperimentTagVocabulary } from '@/domains/experiments/hooks/use-experiment-tag-vocabulary';

function ExperimentItemPage() {
  const { itemId } = useParams<{ itemId: string }>();

  if (!itemId) return null;

  // The route element stays mounted across `:itemId` changes; keying the
  // content remounts it so panel state never leaks between items.
  return <ExperimentItemPageContent key={itemId} itemId={itemId} />;
}

function ExperimentItemPageContent({ itemId }: { itemId: string }) {
  const {
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

  const result = useMemo(() => results.find(r => r.itemId === itemId) ?? null, [results, itemId]);

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
  const [wide, setWide] = useState(false);

  return (
    <RouteItemOverlay label={`Experiment item ${itemId}`} wide={wide}>
      {result ? (
        <ExperimentResultDetail
          className="p-3"
          result={result}
          scores={resultScores}
          onWideChange={setWide}
          onPrevious={goToPreviousItem}
          onNext={goToNextItem}
          onClose={close}
          onComplete={() => completeResult(result.id)}
          onFlagForReview={() => void flagForReview(result.id)}
          onTagsChange={tags => void updateTags(result.id, tags)}
          tagVocabulary={tagVocabulary}
          isUpdatingTags={updateExperimentResult.isPending}
        />
      ) : isLoadingResults || hasNextPage ? (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <Spinner />
          </div>
        </div>
      ) : (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <EmptyState
              iconSlot={<PlayCircle />}
              titleSlot="Item not found"
              descriptionSlot={`No loaded result for item "${itemId}".`}
              actionSlot={<Button onClick={close}>Close</Button>}
            />
          </div>
        </div>
      )}
    </RouteItemOverlay>
  );
}

export { ExperimentItemPage };
export default ExperimentItemPage;

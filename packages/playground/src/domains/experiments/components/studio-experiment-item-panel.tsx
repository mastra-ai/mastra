import type { ExperimentItemPanelProps } from '@mastra/playground-ui/domains/experiments';
import { ExperimentItemPanel, useExperimentItemPanel } from '@mastra/playground-ui/domains/experiments';
import { useDatasetMutations, useScoresByExperimentId } from '@mastra/react/hooks/datasets';
import { useExperimentResultDetailData } from '../hooks/use-experiment-result-detail-data';

export interface StudioExperimentItemPanelProps {
  withFeedback: boolean;
  /** `drawer` (default) for a standalone overlay; `inline` when hosted in the route side panel. */
  variant?: ExperimentItemPanelProps['variant'];
}

/** The shared item panel wired to Studio's scores, review mutations, trace panel, feedback and usage. */
export function StudioExperimentItemPanel({ withFeedback, variant }: StudioExperimentItemPanelProps) {
  const { currentItemId, experimentId, datasetId, experimentStatus, results } = useExperimentItemPanel();
  const result = currentItemId ? results.find(r => r.itemId === currentItemId) : undefined;

  const { data: scoresByItemId } = useScoresByExperimentId({
    experimentId,
    experimentStatus,
    queryOptions: { enabled: Boolean(experimentId) },
  });
  const { updateExperimentResult } = useDatasetMutations();
  const data = useExperimentResultDetailData({
    traceId: result?.traceId,
    scores: result ? scoresByItemId?.[result.itemId] : undefined,
    withFeedback,
  });

  return (
    <ExperimentItemPanel
      {...data}
      variant={variant}
      scoresByItemId={scoresByItemId}
      onFlagForReview={async resultId => {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'needs-review' });
      }}
      onComplete={async resultId => {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'complete' });
      }}
    />
  );
}

import { useDataset } from '@mastra/react/hooks/datasets';
import { useState } from 'react';

/**
 * Which scorers grade the outputs. Unset until the user picks some; the dataset's default scorers apply
 * meanwhile.
 */
export function useScorerChoice({ datasetId, initialScorerIds }: { datasetId: string; initialScorerIds?: string[] }) {
  const { data: dataset } = useDataset({ datasetId, queryOptions: { enabled: Boolean(datasetId) } });
  const [pickedScorerIds, setPickedScorerIds] = useState(initialScorerIds);
  const defaultScorerIds = dataset?.scorerIds ?? [];

  return {
    scorerIds: pickedScorerIds ?? defaultScorerIds,
    usesDefaultScorers: pickedScorerIds === undefined && defaultScorerIds.length > 0,
    setScorerIds: setPickedScorerIds,
    /** Back to the opening scorers, so a new dataset's defaults apply. */
    resetScorers: () => setPickedScorerIds(initialScorerIds),
  };
}

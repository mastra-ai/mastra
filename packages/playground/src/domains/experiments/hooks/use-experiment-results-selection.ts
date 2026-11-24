import type { DatasetExperimentResult } from '@mastra/client-js';
import { useResultsSelection } from '@mastra/playground-ui/domains/experiments';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { useState } from 'react';

import { useAddTagToResults } from './use-add-tag-to-results';
import { useExperimentTagVocabulary } from './use-experiment-tag-vocabulary';

export interface UseExperimentResultsSelectionArgs {
  datasetId: string;
  experimentId: string;
  results: DatasetExperimentResult[];
}

/**
 * Selection state for experiment results plus the bulk actions that act on it
 * (request review, tag). Lives at page level so the results list and the
 * top-area actions can share it.
 */
export function useExperimentResultsSelection({ datasetId, experimentId, results }: UseExperimentResultsSelectionArgs) {
  const selection = useResultsSelection(results);
  const [isFlagging, setIsFlagging] = useState(false);

  const { updateExperimentResult } = useDatasetMutations();
  const { addTag, isPending: isTagging } = useAddTagToResults({ datasetId, experimentId });
  const tagVocabulary = useExperimentTagVocabulary(datasetId, results);

  const flagSelectedForReview = async () => {
    if (isFlagging || selection.selectedIds.size === 0) return;
    setIsFlagging(true);
    const flaggedIds = new Set<string>();
    try {
      for (const resultId of selection.selectedIds) {
        try {
          await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'needs-review' });
          flaggedIds.add(resultId);
        } catch {
          // continue on individual failures
        }
      }
    } finally {
      setIsFlagging(false);
    }
    if (flaggedIds.size > 0) {
      selection.deselect(flaggedIds);
      toast(`${flaggedIds.size} result${flaggedIds.size > 1 ? 's' : ''} flagged for review`);
    }
  };

  return {
    ...selection,
    flagSelectedForReview,
    isFlagging,
    addTagToSelected: (tag: string) => addTag(tag, selection.selectedResults),
    isTagging,
    tagVocabulary,
  };
}

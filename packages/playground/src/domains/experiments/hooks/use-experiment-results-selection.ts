import type { DatasetExperimentResult } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCallback, useMemo, useState } from 'react';

import { useAddTagToResults } from './use-add-tag-to-results';
import { useExperimentTagVocabulary } from './use-experiment-tag-vocabulary';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

export interface UseExperimentResultsSelectionArgs {
  datasetId: string;
  experimentId: string;
  results: DatasetExperimentResult[];
}

/**
 * Selection state for experiment results plus the bulk actions that act on it
 * (flag for review, tag). Lives at page level so the results list and the
 * top-area actions can share it.
 */
export function useExperimentResultsSelection({ datasetId, experimentId, results }: UseExperimentResultsSelectionArgs) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFlagging, setIsFlagging] = useState(false);

  const { updateExperimentResult } = useDatasetMutations();
  const { addTag, isPending: isTagging } = useAddTagToResults({ datasetId, experimentId });
  const tagVocabulary = useExperimentTagVocabulary(datasetId, results);

  const selectedResults = useMemo(() => results.filter(r => selectedIds.has(r.id)), [results, selectedIds]);

  const toggleSelect = useCallback((resultId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const flagSelectedForReview = useCallback(async () => {
    if (isFlagging || selectedIds.size === 0) return;
    setIsFlagging(true);
    const flaggedIds = new Set<string>();
    try {
      for (const resultId of selectedIds) {
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
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of flaggedIds) next.delete(id);
        return next;
      });
      toast(`${flaggedIds.size} result${flaggedIds.size > 1 ? 's' : ''} flagged for review`);
    }
  }, [datasetId, experimentId, isFlagging, selectedIds, updateExperimentResult]);

  const addTagToSelected = useCallback((tag: string) => addTag(tag, selectedResults), [addTag, selectedResults]);

  return {
    selectedIds,
    selectedResults,
    toggleSelect,
    clearSelection,
    flagSelectedForReview,
    isFlagging,
    addTagToSelected,
    isTagging,
    tagVocabulary,
  };
}

export type ExperimentResultsSelection = ReturnType<typeof useExperimentResultsSelection>;

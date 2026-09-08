import type { DatasetExperimentResult } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useCallback, useState } from 'react';

import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

type UseAddTagToResultsArgs = {
  datasetId: string;
  experimentId: string;
};

/**
 * Applies a tag to a batch of experiment results (union with each result's
 * existing tags). Results that already carry the tag are skipped; individual
 * failures do not stop the remaining updates.
 */
export function useAddTagToResults({ datasetId, experimentId }: UseAddTagToResultsArgs) {
  const [isPending, setIsPending] = useState(false);
  const { updateExperimentResult } = useDatasetMutations();

  const addTag = useCallback(
    async (tag: string, results: DatasetExperimentResult[]) => {
      const targets = results.filter(r => !(r.tags ?? []).includes(tag));
      if (isPending || targets.length === 0) return;

      setIsPending(true);
      let added = 0;
      try {
        for (const result of targets) {
          try {
            await updateExperimentResult.mutateAsync({
              datasetId,
              experimentId,
              resultId: result.id,
              tags: [...(result.tags ?? []), tag],
            });
            added++;
          } catch {
            // continue on individual failures
          }
        }
      } finally {
        setIsPending(false);
      }

      if (added > 0) {
        toast(`Tag "${tag}" added to ${added} result${added > 1 ? 's' : ''}`);
      } else {
        toast.error('Failed to add tag');
      }
    },
    [datasetId, experimentId, isPending, updateExperimentResult],
  );

  return { addTag, isPending };
}

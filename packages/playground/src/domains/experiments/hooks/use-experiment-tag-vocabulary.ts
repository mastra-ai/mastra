import type { DatasetExperimentResult } from '@mastra/client-js';
import { useMemo } from 'react';

import { useDataset } from '@/domains/datasets/hooks/use-datasets';

/**
 * Every tag known for an experiment: the dataset's own tags (when the dataset
 * still exists) plus every tag already applied to a loaded result, sorted.
 */
export function useExperimentTagVocabulary(datasetId: string, results: DatasetExperimentResult[]) {
  const { data: dataset } = useDataset(datasetId);

  return useMemo(
    () => [...new Set([...(dataset?.tags ?? []), ...results.flatMap(r => r.tags ?? [])])].sort(),
    [dataset?.tags, results],
  );
}

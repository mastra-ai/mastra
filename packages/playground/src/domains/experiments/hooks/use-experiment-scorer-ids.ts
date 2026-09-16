import type { DatasetExperiment } from '@mastra/client-js';
import { useMemo } from 'react';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';

/**
 * Scorer ids that apply to an experiment. They are pinned on the experiment at
 * create time, but that field is null when they resolve from the dataset or the
 * items, so fall back to whichever scorers actually produced a score.
 */
export function useExperimentScorerIds(experiment: DatasetExperiment): string[] {
  const { data: scoresByItemId } = useScoresByExperimentId(experiment.id, experiment.status);

  return useMemo(() => {
    if (experiment.scorerIds?.length) return experiment.scorerIds;
    if (!scoresByItemId) return [];
    const ids = new Set<string>();
    for (const scores of Object.values(scoresByItemId)) {
      for (const score of scores) ids.add(score.scorerId);
    }
    return [...ids].sort();
  }, [experiment.scorerIds, scoresByItemId]);
}

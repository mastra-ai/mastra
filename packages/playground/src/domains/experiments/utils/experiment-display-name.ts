import type { DatasetExperiment } from '@mastra/client-js';
import { getShortId } from '@mastra/playground-ui/components/Text';

/** The experiment name, or a readable `Experiment #<short id>` when unnamed. */
export function getExperimentDisplayName(experiment: Pick<DatasetExperiment, 'id' | 'name'>): string {
  const shortId = getShortId(experiment.id) ?? experiment.id;
  return experiment.name || `Experiment #${shortId}`;
}

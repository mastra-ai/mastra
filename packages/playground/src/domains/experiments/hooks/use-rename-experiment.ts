import type { DatasetExperiment } from '@mastra/client-js';
import type { RenameExperimentPatch } from '@mastra/playground-ui/domains/experiments';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';

/**
 * Returns `renameHandlerFor(experiment)`, the `onRename` callback for the shared experiment parts.
 * The rename route is dataset-scoped, so caller-run experiments without a dataset get no handler
 * (and so no rename action).
 */
export function useRenameExperiment() {
  const { updateExperiment } = useDatasetMutations();

  return (experiment: Pick<DatasetExperiment, 'id' | 'datasetId'>) => {
    const datasetId = experiment.datasetId;
    if (!datasetId) return undefined;
    return async (patch: RenameExperimentPatch) => {
      await updateExperiment.mutateAsync({ datasetId, experimentId: experiment.id, ...patch });
    };
  };
}

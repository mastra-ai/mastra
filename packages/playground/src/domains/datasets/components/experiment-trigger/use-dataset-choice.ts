import { useDatasets } from '@mastra/react/hooks/datasets';
import { useState } from 'react';
import type { DatasetOption, ExperimentTriggerInitialValues } from './experiment-trigger-options';

/** The picked dataset, or the newest one (the API lists newest first) until one is picked. */
function resolveDatasetId(pickedDatasetId: string, datasets: DatasetOption[]) {
  if (pickedDatasetId) return pickedDatasetId;
  return datasets[0]?.value ?? '';
}

/** Which dataset the experiment runs on, and which of its versions (latest unless one is pinned). */
export function useDatasetChoice({
  initialDatasetId,
  initialDatasetVersion,
}: Pick<ExperimentTriggerInitialValues, 'initialDatasetId' | 'initialDatasetVersion'>) {
  const { data } = useDatasets();
  const datasets: DatasetOption[] = (data?.datasets ?? []).map(dataset => ({ value: dataset.id, label: dataset.name }));
  const [pickedDatasetId, setPickedDatasetId] = useState(initialDatasetId ?? '');
  const [version, setVersion] = useState(initialDatasetVersion);

  // A pinned version belongs to the dataset it was picked on.
  const selectDataset = (datasetId: string) => {
    setPickedDatasetId(datasetId);
    setVersion(undefined);
  };

  return {
    datasets,
    datasetId: resolveDatasetId(pickedDatasetId, datasets),
    version,
    setVersion,
    selectDataset,
  };
}

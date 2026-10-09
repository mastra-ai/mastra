import { useDatasets } from '@mastra/react/hooks/datasets';

/**
 * Suggests "Dataset N" for a new dataset, where N is one past the dataset count,
 * skipping any number already taken by a loaded dataset. Empty until datasets load.
 */
export function useNextDatasetName() {
  const { data } = useDatasets();

  if (!data) return '';

  const takenNames = new Set(data.datasets.map(dataset => dataset.name));
  let next = data.pagination.total + 1;
  while (takenNames.has(`Dataset ${next}`)) next++;

  return `Dataset ${next}`;
}

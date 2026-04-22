import type { DatasetRecord } from '@mastra/client-js';

export const DATASET_TARGET_OPTIONS = [
  { value: 'all', label: 'All targets' },
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
] as const;

export const DATASET_EXPERIMENT_OPTIONS = [
  { value: 'all', label: 'All datasets' },
  { value: 'with', label: 'With experiments' },
  { value: 'without', label: 'Without experiments' },
] as const;

export function getDatasetTagOptions(datasets: DatasetRecord[]) {
  const tagSet = new Set<string>();

  for (const dataset of datasets) {
    if (!Array.isArray(dataset.tags)) continue;

    for (const tag of dataset.tags as string[]) {
      tagSet.add(tag);
    }
  }

  return [
    { value: 'all', label: 'All tags' },
    ...Array.from(tagSet)
      .sort()
      .map(tag => ({ value: tag, label: tag })),
  ];
}

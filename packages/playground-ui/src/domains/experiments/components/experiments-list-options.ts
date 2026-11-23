import type { DatasetRecord } from '@mastra/client-js';

export const EXPERIMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
] as const;

export function getExperimentDatasetOptions(datasets?: DatasetRecord[]) {
  return [{ value: 'all', label: 'All datasets' }, ...(datasets ?? []).map(ds => ({ value: ds.id, label: ds.name }))];
}

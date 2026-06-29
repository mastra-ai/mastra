// Target-type choices shared by the dataset create/edit dialogs. Persisting a dataset's target type
// is what lets the Datasets list classify and filter it by target.
export const DATASET_TARGET_TYPE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'scorer', label: 'Scorer' },
  { value: 'processor', label: 'Processor' },
] as const;

export type DatasetTargetType = (typeof DATASET_TARGET_TYPE_OPTIONS)[number]['value'];

const DATASET_TARGET_TYPE_VALUES: ReadonlySet<string> = new Set(
  DATASET_TARGET_TYPE_OPTIONS.map(option => option.value),
);

export function isDatasetTargetType(value: string | null | undefined): value is DatasetTargetType {
  return typeof value === 'string' && DATASET_TARGET_TYPE_VALUES.has(value);
}

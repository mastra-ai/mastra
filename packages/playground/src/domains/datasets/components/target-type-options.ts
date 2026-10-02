// Target types a dataset can be classified as. `targetType` is no longer chosen in the create/edit
// dialogs; it is set by pre-scoped creation (URL params) or derived from experiments for display.
export const DATASET_TARGET_TYPES = ['agent', 'workflow', 'scorer', 'processor'] as const;

export type DatasetTargetType = (typeof DATASET_TARGET_TYPES)[number];

const DATASET_TARGET_TYPE_VALUES: ReadonlySet<string> = new Set(DATASET_TARGET_TYPES);

export function isDatasetTargetType(value: string | null | undefined): value is DatasetTargetType {
  return typeof value === 'string' && DATASET_TARGET_TYPE_VALUES.has(value);
}

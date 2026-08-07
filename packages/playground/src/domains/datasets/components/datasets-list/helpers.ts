import type { DatasetRecord } from '@mastra/client-js';
import type { DatasetTargetType } from '../target-type-options';
import { DATASET_TARGET_TYPE_OPTIONS, isDatasetTargetType } from '../target-type-options';

export type DatasetTargetFilter = 'all' | 'none' | DatasetTargetType;

// 'none' surfaces legacy/untyped datasets (created before targetType was persisted) so they can be
// found and classified instead of silently disappearing under a type filter.
export const DATASET_TARGET_OPTIONS = [
  { value: 'all', label: 'All targets' },
  ...DATASET_TARGET_TYPE_OPTIONS,
  { value: 'none', label: 'No target' },
] as const satisfies readonly { value: DatasetTargetFilter; label: string }[];

/** Target-filter predicate for the Datasets list. `targetTypes` comes from
 *  `getDatasetTargetTypes` (explicit type, or derived from experiments). */
export function matchesDatasetTargetFilter(targetTypes: readonly DatasetTargetType[], targetFilter: string): boolean {
  if (targetFilter === 'all') return true;
  if (targetFilter === 'none') return targetTypes.length === 0;
  return isDatasetTargetType(targetFilter) && targetTypes.includes(targetFilter);
}

export const DATASET_EXPERIMENT_OPTIONS = [
  { value: 'all', label: 'All datasets' },
  { value: 'with', label: 'With experiments' },
  { value: 'without', label: 'Without experiments' },
] as const;

/** `targetType` is persisted by create/edit flows and is the source of truth.
 *  When absent, `getDatasetTargetTypes` falls back to the distinct target type(s)
 *  from the dataset's experiments so legacy/imported datasets can still be
 *  classified. Returns one type when known, several when experiments span types. */
export function getDatasetTargetTypes(
  targetType: string | null | undefined,
  experiments: Array<{ targetType?: string | null }>,
): DatasetTargetType[] {
  if (isDatasetTargetType(targetType)) return [targetType];
  // Sorted so the derived list renders in a stable order regardless of experiment order.
  return Array.from(new Set(experiments.map(e => e.targetType).filter(isDatasetTargetType))).sort();
}

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

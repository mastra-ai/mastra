import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { isDatasetTargetType, type DatasetTargetType } from '@/domains/datasets/components/target-type-options';

export const TARGET_TYPE_PARAM = 'targetType';
export const TARGET_ID_PARAM = 'targetId';

export interface TargetFilterParams {
  targetType: DatasetTargetType | '';
  targetId: string;
  setTargetType: (type: DatasetTargetType | '') => void;
  setTargetId: (id: string) => void;
  clear: () => void;
}

export interface TargetFilterParamsOptions {
  /** Extra params to drop whenever the target changes (e.g. a selection that only makes sense in the previous scope). */
  resetParams?: string[];
}

/**
 * Reads and writes the `?targetType=` / `?targetId=` URL params that scope list pages
 * (datasets, experiments, review queue) to a single entity. Other search params are preserved.
 * Changing the type always drops the id since ids are only meaningful within a type.
 */
export function useTargetFilterParams({ resetParams = [] }: TargetFilterParamsOptions = {}): TargetFilterParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const resetParamsKey = resetParams.join(',');

  const rawType = searchParams.get(TARGET_TYPE_PARAM);
  const targetType: DatasetTargetType | '' = isDatasetTargetType(rawType) ? rawType : '';
  const targetId = targetType ? (searchParams.get(TARGET_ID_PARAM) ?? '') : '';

  const setTargetType = useCallback(
    (type: DatasetTargetType | '') => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (type) next.set(TARGET_TYPE_PARAM, type);
          else next.delete(TARGET_TYPE_PARAM);
          next.delete(TARGET_ID_PARAM);
          for (const param of resetParamsKey.split(',')) if (param) next.delete(param);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, resetParamsKey],
  );

  const setTargetId = useCallback(
    (id: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (id) next.set(TARGET_ID_PARAM, id);
          else next.delete(TARGET_ID_PARAM);
          for (const param of resetParamsKey.split(',')) if (param) next.delete(param);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, resetParamsKey],
  );

  const clear = useCallback(() => setTargetType(''), [setTargetType]);

  return { targetType, targetId, setTargetType, setTargetId, clear };
}

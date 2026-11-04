import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_COMPARED_EXPERIMENTS } from '@/domains/experiments/components/comparison/constants';

/** Reads the compared experiments from the URL: one baseline and up to `MAX_COMPARED_EXPERIMENTS - 1` contenders. */
export function useComparedExperimentIds() {
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset') ?? undefined;
  const baselineId = searchParams.get('baseline') ?? undefined;
  const contenderIds = useMemo(
    () =>
      [...new Set(searchParams.getAll('contender'))]
        .filter(id => id && id !== baselineId)
        .slice(0, MAX_COMPARED_EXPERIMENTS - 1),
    [searchParams, baselineId],
  );
  return { datasetId, baselineId, contenderIds };
}

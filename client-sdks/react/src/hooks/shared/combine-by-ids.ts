import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

/** One entry per requested experiment id, in the order the ids were given. */
export interface ExperimentQueriesResult<T> {
  data: Record<string, T | undefined>;
  /** True while any experiment has not loaded yet. */
  isLoading: boolean;
  /** First error among the experiments, if any. */
  error: Error | null;
}

/**
 * Stable `combine` for `useQueries`: keyed on the ids' contents (callers pass a fresh array every
 * render), so TanStack only recombines when a query result actually changes.
 */
export const useCombineByIds = <T>(ids: string[]) => {
  const idsKey = JSON.stringify(ids);
  return useCallback(
    (results: Array<UseQueryResult<T, Error>>): ExperimentQueriesResult<T> => {
      const data: Record<string, T | undefined> = {};
      (JSON.parse(idsKey) as string[]).forEach((id, index) => {
        data[id] = results[index]?.data;
      });
      return {
        data,
        isLoading: results.some(result => result.isLoading),
        error: results.find(result => result.error)?.error ?? null,
      };
    },
    [idsKey],
  );
};

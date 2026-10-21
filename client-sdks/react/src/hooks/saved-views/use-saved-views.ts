import type { SavedViewResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { is404NotFoundError, shouldRetryQuery } from '../query/query-utils';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * True when the server can't serve saved views: 501 (the storage has no
 * `savedViews` domain) or 404 (a server older than the saved-views routes).
 * Callers hide the feature instead of showing an error.
 */
export function isSavedViewsUnavailableError(error: unknown): boolean {
  if (is404NotFoundError(error)) return true;
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 501;
}

/**
 * Lists the saved views for one Studio page, oldest first. Never retries a
 * 404 or 501; check `isSavedViewsUnavailableError(error)` to hide the feature.
 */
export const useSavedViews = <TData = SavedViewResponse[]>({
  page,
  queryOptions,
}: {
  page: string;
  queryOptions?: MastraQueryOptions<SavedViewResponse[], TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<SavedViewResponse[], Error, TData>({
    queryKey: ['saved-views', page],
    queryFn: async () => {
      const result = await client.listSavedViews({ page });
      return result.views;
    },
    retry: shouldRetryQuery,
    ...queryOptions,
  });
};

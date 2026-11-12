import { infiniteQueryOptions, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeCandidateListResponse } from '../api/types';
import { listIntakeCandidates } from '../ui/domains/factory/services/intakeCandidates';
import { sourceFromExternalSource } from '../ui/domains/factory/services/workItems';
import type { WorkItem } from '../ui/domains/factory/services/workItems';

/**
 * The project's open issues and pull requests that have no card yet, one page at a time.
 * Nothing here asks again on a timer or on focus: the feed stream says when the list changed.
 */
export function intakeCandidatesQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return infiniteQueryOptions({
    queryKey: queryKeys.intakeCandidates(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ pageParam, signal }: { pageParam: string; signal: AbortSignal }) =>
          listIntakeCandidates(baseUrl, factoryProjectId, pageParam || undefined, signal)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: (lastPage: IntakeCandidateListResponse) => lastPage.nextCursor,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useIntakeCandidatesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery(intakeCandidatesQueryOptions(baseUrl, factoryProjectId));
}

/** A record filed as a card leaves the list at once; the stream's reread only confirms it. */
export function dropIntakeCandidate(
  queryClient: QueryClient,
  factoryProjectId: string | undefined,
  filed: Pick<WorkItem, 'source' | 'sourceKey'>,
) {
  queryClient.setQueryData<InfiniteData<IntakeCandidateListResponse, string>>(
    queryKeys.intakeCandidates(factoryProjectId),
    list =>
      list && {
        ...list,
        pages: list.pages.map(page => ({
          ...page,
          candidates: page.candidates.filter(
            ({ externalSource }) =>
              externalSource.externalId !== filed.sourceKey ||
              sourceFromExternalSource(externalSource) !== filed.source,
          ),
        })),
      },
  );
}

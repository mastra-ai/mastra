import { infiniteQueryOptions, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeCandidateListResponse } from '../api/types';
import { listIntakeCandidates } from '../ui/domains/factory/services/intakeCandidates';
import type { IntakeCandidateFilter } from '../ui/domains/factory/services/intakeCandidates';
import { sourceFromExternalSource } from '../ui/domains/factory/services/workItems';
import type { WorkItem } from '../ui/domains/factory/services/workItems';

/**
 * The project's open issues and pull requests that have no card yet, one page at a time.
 * Nothing here asks again on a timer or on focus: the feed stream says when the list changed.
 */
export function intakeCandidatesQueryOptions(
  baseUrl: string,
  factoryProjectId: string | undefined,
  filter: IntakeCandidateFilter = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.intakeCandidates(factoryProjectId, filter),
    queryFn: factoryProjectId
      ? ({ pageParam, signal }: { pageParam: string; signal: AbortSignal }) =>
          listIntakeCandidates(baseUrl, factoryProjectId, filter, pageParam || undefined, signal)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: (lastPage: IntakeCandidateListResponse) => lastPage.nextCursor,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Without `factoryProjectId` the list is not read. */
export function useIntakeCandidatesQuery(factoryProjectId: string | undefined, filter?: IntakeCandidateFilter) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery(intakeCandidatesQueryOptions(baseUrl, factoryProjectId, filter));
}

/** A record filed as a card leaves every list at once; the stream's reread only confirms it. */
export function dropIntakeCandidate(
  queryClient: QueryClient,
  factoryProjectId: string | undefined,
  filed: Pick<WorkItem, 'source' | 'sourceKey'>,
) {
  queryClient.setQueriesData<InfiniteData<IntakeCandidateListResponse, string>>(
    { queryKey: queryKeys.intakeCandidates(factoryProjectId) },
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

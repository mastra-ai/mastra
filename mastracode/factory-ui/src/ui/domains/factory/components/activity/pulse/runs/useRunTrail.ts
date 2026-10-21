import { MAX_AUDIT_PAGE_SIZE } from '@mastra/factory/storage/domains/audit/wire';
import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useApiConfig } from '../../../../../../../api/config';
import { queryKeys } from '../../../../../../../api/keys';
import { fetchAuditEvents } from '../../../../services/audit';
import { foldHeadPage, runPage, runTrail } from './runTrail';
import type { RunPage, RunTrail } from './runTrail';

const RUN_NAMESPACES = ['run'];
const HEAD_RUN_EVENTS = 100;
const HEAD_REFRESH_MS = 10_000;
const NEWEST_PAGE: string | undefined = undefined;

interface TrailSource {
  baseUrl: string;
  factoryProjectId: string;
}

async function readRunPage(
  { baseUrl, factoryProjectId }: TrailSource,
  page: { before: string | undefined; limit: number; signal: AbortSignal },
): Promise<RunPage> {
  const auditPage = await fetchAuditEvents(baseUrl, factoryProjectId, {
    namespaces: RUN_NAMESPACES,
    skipActorProfiles: true,
    ...page,
  });
  return runPage(auditPage);
}

function trailPagesOptions(source: TrailSource) {
  return infiniteQueryOptions({
    queryKey: queryKeys.factoryAudit(source.factoryProjectId, 'pulse:trail'),
    queryFn: ({ pageParam, signal }) => readRunPage(source, { before: pageParam, limit: MAX_AUDIT_PAGE_SIZE, signal }),
    initialPageParam: NEWEST_PAGE,
    getNextPageParam: (page: RunPage) => page.nextCursor,
    enabled: false,
  });
}

function headPollOptions(source: TrailSource, queryClient: QueryClient, live: boolean) {
  const { queryKey: trailKey } = trailPagesOptions(source);
  return queryOptions({
    queryKey: queryKeys.factoryAudit(source.factoryProjectId, 'pulse:head'),
    queryFn: async ({ signal }) => {
      const head = await readRunPage(source, { before: NEWEST_PAGE, limit: HEAD_RUN_EVENTS, signal });
      const pages = queryClient.getQueryData(trailKey);
      const folded = foldHeadPage(pages, head);
      if (folded !== pages) queryClient.setQueryData(trailKey, folded);
      return head;
    },
    refetchInterval: live ? HEAD_REFRESH_MS : false,
  });
}

export interface RunTrailState {
  trail: RunTrail | undefined;
  failed: boolean;
  retry: () => void;
  loadingEarlier: boolean;
  earlierFailed: boolean;
  retryEarlier: () => void;
}

export function useRunTrail({
  factoryProjectId,
  viewStartMs,
  live,
}: {
  factoryProjectId: string;
  viewStartMs: number;
  live: boolean;
}): RunTrailState {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const source = { baseUrl, factoryProjectId };
  const head = useQuery(headPollOptions(source, queryClient, live));
  const { data, hasNextPage, isFetching, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery(
    trailPagesOptions(source),
  );
  const trail = useMemo(() => data && runTrail(data.pages), [data]);

  const oldestLoadedMs = data?.pages.at(-1)?.oldestMs;
  const viewReachesPastLoaded = hasNextPage && oldestLoadedMs !== undefined && oldestLoadedMs > viewStartMs;
  const shouldReadOlderPage = viewReachesPastLoaded && !isFetching && !isError;

  // A page can land without a render that shows it fetching, so key on the paging frontier too.
  useEffect(() => {
    if (shouldReadOlderPage) void fetchNextPage();
  }, [shouldReadOlderPage, oldestLoadedMs, fetchNextPage]);

  return {
    trail,
    failed: head.isLoadingError,
    retry: () => void head.refetch(),
    loadingEarlier: viewReachesPastLoaded && isFetchingNextPage,
    earlierFailed: viewReachesPastLoaded && isError,
    retryEarlier: () => void fetchNextPage(),
  };
}

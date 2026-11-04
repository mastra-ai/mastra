import type { GetWorkflowRunByIdResponse, MastraClient } from '@mastra/client-js';
import type { QueryKey, UseInfiniteQueryResult, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

type WorkflowRuns = Awaited<ReturnType<ReturnType<MastraClient['getWorkflow']>['runs']>>;

export const PER_PAGE = 20;

export function getWorkflowRunsNextPageParam(lastPage: WorkflowRuns, _allPages: unknown, lastPageParam: number) {
  if (lastPage.runs.length < PER_PAGE) {
    return undefined;
  }
  return lastPageParam + 1;
}

export function selectUniqueRuns(data: { pages: WorkflowRuns[] }) {
  const seen = new Set<string>();
  return data.pages
    .flatMap(page => page.runs)
    .filter(run => {
      if (seen.has(run.runId)) return false;
      seen.add(run.runId);
      return true;
    });
}

/**
 * `summary: true` asks the server to reduce each run snapshot to `{ status, timestamp }`,
 * avoiding transfer of full snapshots when only list metadata is displayed.
 */
export const useWorkflowRuns = <TData = ReturnType<typeof selectUniqueRuns>>({
  workflowId,
  summary = false,
  queryOptions,
}: {
  workflowId: string;
  summary?: boolean;
  queryOptions?: MastraInfiniteQueryOptions<WorkflowRuns, TData, QueryKey, number>;
}): UseInfiniteQueryResult<TData, Error> & {
  setEndOfListElement: ReturnType<typeof useInView>['setRef'];
} => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const query = useInfiniteQuery({
    queryKey: ['workflow-runs', workflowId, { summary }],
    queryFn: ({ pageParam }) =>
      client
        .getWorkflow(workflowId)
        .runs({ limit: PER_PAGE, offset: pageParam * PER_PAGE, ...(summary ? { summary: true } : {}) }),
    initialPageParam: 0,
    getNextPageParam: getWorkflowRunsNextPageParam,
    select: data => selectUniqueRuns(data) as TData,
    retry: false,
    refetchInterval: 5000,
    ...queryOptions,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};

export const workflowRunQueryKey = (workflowId: string, runId: string) => ['workflow-run', workflowId, runId] as const;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useWorkflowRun = <TData = GetWorkflowRunByIdResponse>({
  workflowId,
  runId,
  queryOptions,
}: {
  workflowId: string;
  runId: string;
  queryOptions?: MastraQueryOptions<GetWorkflowRunByIdResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery<GetWorkflowRunByIdResponse, Error, TData>({
    queryKey: workflowRunQueryKey(workflowId, runId),
    queryFn: () => client.getWorkflow(workflowId).runById(runId),
    gcTime: 0,
    staleTime: 0,
    ...queryOptions,
  });
};

export const useDeleteWorkflowRun = ({
  workflowId,
  queryOptions,
}: {
  workflowId: string;
  queryOptions?: MastraMutationOptions<unknown, { runId: string }>;
}): UseMutationResult<unknown, Error, { runId: string }> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId }: { runId: string }) => client.getWorkflow(workflowId).deleteRunById(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-runs', workflowId] });
    },
    ...queryOptions,
  });
};

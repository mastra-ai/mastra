import { useMastraClient } from '@mastra/react';
import { WorkflowRuns } from '@mastra/core/storage';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from './use-in-view';
import { useEffect } from 'react';
import { toast } from '@/lib/toast';

export const PER_PAGE = 20;

/** Returns the next page number if the last page was full, indicating more results may exist. */
export function getWorkflowRunsNextPageParam(lastPage: WorkflowRuns, _allPages: unknown, lastPageParam: number) {
  if (lastPage.runs.length < PER_PAGE) {
    return undefined;
  }
  return lastPageParam + 1;
}

/** Deduplicates workflow runs by runId across all loaded pages, keeping the first occurrence. */
export function selectUniqueRuns(data: { pages: WorkflowRuns[] }) {
  const seen = new Set<string>();
  return data.pages.flatMap(page => page.runs).filter(run => {
    if (seen.has(run.runId)) return false;
    seen.add(run.runId);
    return true;
  });
}

export const useWorkflowRuns = (workflowId: string, { enabled = true }: { enabled?: boolean } = {}) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();
  const query = useInfiniteQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: ({ pageParam }) => client.getWorkflow(workflowId).runs({ limit: PER_PAGE, offset: pageParam * PER_PAGE }),
    initialPageParam: 0,
    getNextPageParam: getWorkflowRunsNextPageParam,
    select: selectUniqueRuns,
    retry: false,
    enabled,
    refetchInterval: 5000,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};

export const useWorkflowRun = (workflowId: string, runId: string, refetchInterval?: number) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow-run', workflowId, runId],
    queryFn: () => client.getWorkflow(workflowId).runById(runId),
    enabled: Boolean(workflowId && runId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval,
  });
};

export const useDeleteWorkflowRun = (workflowId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ runId }: { runId: string }) => client.getWorkflow(workflowId).deleteRunById(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-runs', workflowId] });
      toast.success('Workflow run deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete workflow run');
    },
  });
};

import type { ListWorkflowRunCountsResponse } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const RUN_COUNTS_REFETCH_INTERVAL_MS = 5000;

const NO_COUNTS: ListWorkflowRunCountsResponse = {};

/** Older servers don't ship the endpoint — that (and only that) ends polling. */
export function isRunCountsUnsupported(error: unknown): boolean {
  return error instanceof MastraClientError && error.status === 404;
}

/**
 * Poll cadence: keep polling through transient failures (a blip must not
 * silence the counts forever), but stop entirely once the server has said the
 * endpoint does not exist.
 */
export function runCountsRefetchInterval(error: unknown): number | false {
  return isRunCountsUnsupported(error) ? false : RUN_COUNTS_REFETCH_INTERVAL_MS;
}

/**
 * Per-workflow counts of `running` (in-flight) and `suspended` (stopped at a
 * suspend() point awaiting resume — the human-in-the-loop state) runs, keyed
 * by the workflow registry key.
 *
 * One lightweight server request per poll — the server aggregates counts
 * across workflows (GET /workflows/run-counts). Older servers 404 the first
 * request; polling then stops and the list renders without count columns.
 */
export const useWorkflowsRunCounts = (): ListWorkflowRunCountsResponse => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  const { data } = useQuery({
    queryKey: ['workflow-run-counts', requestContext],
    queryFn: () => client.listWorkflowRunCounts(requestContext),
    retry: false,
    refetchInterval: query => runCountsRefetchInterval(query.state.error),
  });

  return data ?? NO_COUNTS;
};

import { useMastraClient } from '@mastra/react';
import { useQueries } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

const RUN_COUNTS_REFETCH_INTERVAL_MS = 5000;

/** Statuses surfaced on the list: in-flight runs and HITL runs awaiting resume(). */
const COUNTED_STATUSES = ['running', 'suspended'] as const;
type CountedStatus = (typeof COUNTED_STATUSES)[number];

export type WorkflowRunCounts = Record<CountedStatus, number>;

/**
 * Per-workflow counts of `running` (in-flight) and `suspended` (stopped at a
 * suspend() point awaiting resume — the human-in-the-loop state) runs.
 *
 * There is no cross-workflow runs endpoint, so each (workflow, status) pair
 * asks that workflow's runs endpoint for a single item and reads the
 * server-side `total`. Polling keeps the list reflecting runs started,
 * suspended, or finished outside this tab.
 */
export const useWorkflowsRunCounts = (workflowIds: string[]) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQueries({
    queries: workflowIds.flatMap(workflowId =>
      COUNTED_STATUSES.map(status => ({
        queryKey: ['workflow-run-count', workflowId, status, requestContext] as const,
        queryFn: async () => {
          const { total } = await client.getWorkflow(workflowId).runs({ status, perPage: 1 }, requestContext);
          return total;
        },
        refetchInterval: RUN_COUNTS_REFETCH_INTERVAL_MS,
      })),
    ),
    combine: results => {
      const counts: Record<string, WorkflowRunCounts> = {};
      workflowIds.forEach((id, workflowIndex) => {
        counts[id] = Object.fromEntries(
          COUNTED_STATUSES.map((status, statusIndex) => [
            status,
            results[workflowIndex * COUNTED_STATUSES.length + statusIndex]?.data ?? 0,
          ]),
        ) as WorkflowRunCounts;
      });
      return counts;
    },
  });
};

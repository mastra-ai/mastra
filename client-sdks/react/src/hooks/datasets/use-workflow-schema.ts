import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type WorkflowSchemaResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkflow']>['getSchema']>>;

/**
 * Hook to fetch workflow input/output schema by workflow ID.
 * Returns { inputSchema, outputSchema } where each is Record<string, unknown> | null.
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useWorkflowSchema<TData = WorkflowSchemaResponse>({
  workflowId,
  queryOptions,
}: {
  workflowId: string | null;
  queryOptions?: MastraQueryOptions<WorkflowSchemaResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workflow-schema', workflowId],
    queryFn: async () => {
      if (!workflowId) throw new Error('No workflow selected');
      return client.getWorkflow(workflowId).getSchema();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    ...queryOptions,
  });
}

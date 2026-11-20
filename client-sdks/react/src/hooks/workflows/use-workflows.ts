import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type WorkflowsResponse = Awaited<ReturnType<MastraClient['listWorkflows']>>;

export const useWorkflows = <TData = WorkflowsResponse>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<WorkflowsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['workflows', requestContext],
    queryFn: async (): Promise<WorkflowsResponse> => {
      const workflows = await client.listWorkflows(requestContext);
      // Filter out processor workflows - they're shown on the Processors tab instead
      return Object.fromEntries(Object.entries(workflows).filter(([_, workflow]) => !workflow.isProcessorWorkflow));
    },
    ...queryOptions,
  });
};

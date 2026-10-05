import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type WorkflowResponse = Awaited<ReturnType<ReturnType<MastraClient['getWorkflow']>['details']>> | null;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useWorkflow = <TData = WorkflowResponse>({
  workflowId,
  requestContext,
  queryOptions,
}: {
  workflowId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<WorkflowResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => (workflowId ? client.getWorkflow(workflowId).details(requestContext) : null),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    ...queryOptions,
  });
};

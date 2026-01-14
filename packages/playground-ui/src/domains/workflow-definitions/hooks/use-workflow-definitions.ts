import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const workflowDefinitionsQueryKey = ['workflow-definitions'] as const;

export interface UseWorkflowDefinitionsParams {
  page?: number;
  perPage?: number;
  ownerId?: string;
}

export function useWorkflowDefinitions(params?: UseWorkflowDefinitionsParams) {
  const client = useMastraClient();

  return useQuery({
    queryKey: [...workflowDefinitionsQueryKey, params],
    queryFn: async () => {
      const response = await client.listWorkflowDefinitions({
        page: params?.page,
        perPage: params?.perPage,
        ownerId: params?.ownerId,
      });
      return response;
    },
  });
}

import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface UseToolsParams {
  toolService?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * Lists tools from a `ToolIntegration` with optional service/search/pagination.
 */
export const useTools = (integrationId: string | null, params?: UseToolsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: [
      'tool-integration-tools',
      integrationId,
      params?.toolService,
      params?.search,
      params?.page,
      params?.perPage,
    ],
    queryFn: () => client.getToolIntegration(integrationId!).listTools(params),
    enabled: !!integrationId,
  });
};

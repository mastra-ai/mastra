import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface UseToolsParams {
  toolkit?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * Lists tools from a `ToolProvider` with optional service/search/pagination.
 */
export const useTools = (providerId: string | null, params?: UseToolsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-tools', providerId, params?.toolkit, params?.search, params?.page, params?.perPage],
    queryFn: () => client.getToolProvider(providerId!).listTools(params),
    enabled: !!providerId,
  });
};

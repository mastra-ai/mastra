import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useTools = (options?: { enabled?: boolean }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools', requestContext],
    queryFn: () => client.listTools(requestContext),
    enabled: options?.enabled !== false,
  });
};

export const useTool = (toolId: string, options?: { enabled?: boolean }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool', toolId, requestContext],
    queryFn: () => client.getTool(toolId).details(requestContext),
    enabled: options?.enabled !== false,
  });
};

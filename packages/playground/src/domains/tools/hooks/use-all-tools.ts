import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useTools = (options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => client.listTools(),
    enabled: options?.enabled !== false,
  });
};

export const useTool = (toolId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool', toolId],
    queryFn: () => client.getTool(toolId).details(),
    enabled: options?.enabled !== false,
  });
};

import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useTools = () => {
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => client.listTools(requestContext),
  });
};

export const useTool = (toolId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['tool', toolId],
    queryFn: () => client.getTool(toolId).details(requestContext),
    enabled: options?.enabled !== false,
  });
};

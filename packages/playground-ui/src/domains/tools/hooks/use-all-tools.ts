import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useTools = () => {
  const { requestContext } = usePlaygroundStore();
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => client.getTools(requestContext),
  });
};

export const useTool = (toolId: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['tool', toolId],
    queryFn: () => client.getTool(toolId).details(requestContext),
  });
};

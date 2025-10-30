import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useTools = () => {
  const { runtimeContext } = usePlaygroundStore();
  const client = useMastraClient();
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => client.listTools(runtimeContext),
  });
};

export const useTool = (toolId: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['tool', toolId],
    queryFn: () => client.getTool(toolId).details(runtimeContext),
  });
};

import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useWorkflows = () => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['workflows', JSON.stringify(runtimeContext)],
    queryFn: () => client.listWorkflows(runtimeContext),
  });
};

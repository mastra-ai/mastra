import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

export const useWorkflows = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['workflows', JSON.stringify(requestContext)],
    queryFn: () => client.listWorkflows(requestContext),
  });
};

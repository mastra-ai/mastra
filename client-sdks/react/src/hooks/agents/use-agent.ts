import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useAgent = (agentId?: string, requestContext?: Record<string, any>) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    enabled: Boolean(agentId),
  });
};

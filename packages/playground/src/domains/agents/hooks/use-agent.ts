import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMergedRequestContext } from '@/domains/request-context';

export const useAgent = (agentId?: string) => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    enabled: Boolean(agentId),
  });
};

import { useOptionalRequestContext } from '@mastra/playground-ui/domains/request-context';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useAgent = (agentId?: string) => {
  const client = useMastraClient();
  const requestContext = useOptionalRequestContext();

  return useQuery({
    queryKey: ['agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    enabled: Boolean(agentId),
    // Preserve the chat and popover during context refetches, but never show
    // another agent's details while navigating.
    placeholderData: (previousData, previousQuery) =>
      agentId && previousQuery?.queryKey[1] === agentId ? previousData : undefined,
  });
};

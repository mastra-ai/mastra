import { useOptionalRequestContext } from '@mastra/playground-ui/domains/request-context';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const useAgent = (agentId?: string) => {
  const client = useMastraClient();
  const requestContext = useOptionalRequestContext();

  return useQuery({
    queryKey: ['agent', agentId, requestContext],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    enabled: Boolean(agentId),
    // The key changes whenever the per-entity request context is saved; keep the
    // previous agent so the page doesn't drop into its loading skeleton (which
    // would remount the chat and close the run options popover).
    placeholderData: keepPreviousData,
  });
};

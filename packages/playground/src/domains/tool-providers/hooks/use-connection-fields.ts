import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists provider-specific fields the picker should collect before
 * initiating a new connection (e.g. Confluence subdomain). Most tool
 * services return an empty array, in which case the picker should
 * skip the inline field form.
 */
export const useConnectionFields = (providerId: string | null | undefined, toolkit: string | null | undefined) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-connection-fields', providerId, toolkit],
    queryFn: () => client.getToolProvider(providerId!).listConnectionFields({ toolkit: toolkit! }),
    enabled: !!providerId && !!toolkit,
    staleTime: 5 * 60 * 1000,
  });
};

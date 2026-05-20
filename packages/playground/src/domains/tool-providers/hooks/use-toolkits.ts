import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists tool services exposed by a `ToolProvider` (e.g. `gmail`, `github`).
 */
export const useToolkits = (providerId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integration-services', providerId],
    queryFn: () => client.getToolProvider(providerId!).listToolkits(),
    enabled: !!providerId,
  });
};

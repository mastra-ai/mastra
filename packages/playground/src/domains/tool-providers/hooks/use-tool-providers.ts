import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists all `ToolProvider` providers registered on `MastraEditor`.
 */
export const useToolProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integrations'],
    queryFn: () => client.listToolProviders(),
  });
};

import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Lists all `ToolIntegration` providers registered on `MastraEditor`.
 */
export const useToolIntegrations = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-integrations'],
    queryFn: () => client.listToolIntegrations(),
  });
};

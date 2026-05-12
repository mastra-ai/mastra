import { MastraClientError } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type LogJsonField = 'metadata' | 'data';

export const useLogJsonKeys = (field: LogJsonField) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-log-json-keys', field],
    queryFn: async () => {
      try {
        return await client.getLogJsonKeys({ field });
      } catch (error) {
        // Backwards-compat: older servers don't have this discovery route. Treat
        // "route not registered / not implemented" as "no keys discovered" so the
        // picker still works. Any other failure (network, auth, 5xx) is a real
        // error — let react-query surface it.
        if (error instanceof MastraClientError && (error.status === 404 || error.status === 501)) {
          return { keys: [] };
        }
        throw error;
      }
    },
    select: data => data?.keys ?? [],
    retry: false,
  });
};

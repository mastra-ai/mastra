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
      } catch {
        // Storage provider may not support this discovery
        return { keys: [] };
      }
    },
    select: data => data?.keys ?? [],
    retry: false,
  });
};

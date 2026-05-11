import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type RootSpanJsonField = 'metadata' | 'attributes';

export const useRootSpanJsonKeys = (field: RootSpanJsonField) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-root-span-json-keys', field],
    queryFn: async () => {
      try {
        return await client.getRootSpanJsonKeys({ field });
      } catch {
        // Storage provider may not support this discovery
        return { keys: [] };
      }
    },
    select: data => data?.keys ?? [],
    retry: false,
  });
};

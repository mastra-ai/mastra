import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useTags = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-tags'],
    queryFn: async () => {
      try {
        return await client.getTags();
      } catch {
        // Storage provider may not support tag discovery (e.g. LibSQL)
        return { tags: [] };
      }
    },
    select: data => data?.tags ?? [],
    retry: false,
  });
};

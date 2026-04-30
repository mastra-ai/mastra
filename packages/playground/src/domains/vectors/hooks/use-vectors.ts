import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface Vector {
  name: string;
  id: string;
  description?: string;
}

export function useVectors() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['vectors'],
    queryFn: async () => {
      const data = await client.listVectors();
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

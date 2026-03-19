import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export interface Embedder {
  id: string;
  provider: string;
  name: string;
  description: string;
  dimensions: number;
  maxInputTokens: number;
}

export function useEmbedders() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['embedders'],
    queryFn: async () => {
      const data = await client.listEmbedders();
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

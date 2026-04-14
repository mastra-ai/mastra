import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to list all experiments across all datasets with optional pagination
 */
export const useExperiments = (pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['experiments', pagination],
    queryFn: () => client.listExperiments(pagination),
  });
};

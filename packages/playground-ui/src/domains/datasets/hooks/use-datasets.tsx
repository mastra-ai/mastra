import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useDatasets = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => client.listDatasets(),
    staleTime: 0,
    gcTime: 0,
  });
};

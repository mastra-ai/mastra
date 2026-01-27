import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useDataset = (datasetId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => client.getDataset(datasetId),
    enabled: options?.enabled !== false && !!datasetId,
  });
};

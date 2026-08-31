import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const mastraPackagesQueryKey = ['mastra-packages'] as const;

export const useMastraPackages = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: mastraPackagesQueryKey,
    queryFn: () => {
      return client.getSystemPackages();
    },
  });
};

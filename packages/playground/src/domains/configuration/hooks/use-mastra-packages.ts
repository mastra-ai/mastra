import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useMastraPackages = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mastra-packages'],
    queryFn: () => {
      return client.getSystemPackages();
    },
  });
};

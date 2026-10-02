import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useMastraPackages = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mastra-packages'],
    queryFn: () => {
      return client.getSystemPackages();
    },
  });
};

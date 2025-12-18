import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { USE_MOCK_PACKAGE_DATA, mockInstalledPackages } from './__mocks__/package-data';

export const useMastraPackages = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['mastra-packages'],
    queryFn: () => {
      if (USE_MOCK_PACKAGE_DATA) {
        return Promise.resolve({ packages: mockInstalledPackages });
      }
      return client.getSystemPackages();
    },
  });
};

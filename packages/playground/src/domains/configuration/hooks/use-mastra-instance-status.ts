import { useQuery } from '@tanstack/react-query';

export type UseMastraInstanceStatusResponse = {
  status: 'active' | 'inactive';
};

const getMastraInstanceStatus = async (
  endpoint: string = 'http://localhost:4111',
  headers?: Record<string, string>,
): Promise<UseMastraInstanceStatusResponse> => {
  try {
    const response = await fetch(endpoint, { headers });

    return { status: response.ok ? 'active' : 'inactive' };
  } catch {
    return { status: 'inactive' };
  }
};

export const useMastraInstanceStatus = (
  endpoint: string = 'http://localhost:4111',
  headers?: Record<string, string>,
) => {
  return useQuery({
    queryKey: ['mastra-instance-status', endpoint, headers],
    queryFn: () => getMastraInstanceStatus(endpoint, headers),
    retry: false,
  });
};

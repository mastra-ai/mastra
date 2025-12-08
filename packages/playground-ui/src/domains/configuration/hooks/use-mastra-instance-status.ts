import { useQuery } from '@tanstack/react-query';

export type UseMastraInstanceStatusResponse = {
  status: 'active' | 'inactive';
};

const getMastraInstanceStatus = async (
  endpoint: string = 'http://localhost:4111',
): Promise<UseMastraInstanceStatusResponse> => {
  try {
    const response = await fetch(endpoint);

    return { status: response.ok ? 'active' : 'inactive' };
  } catch {
    return { status: 'inactive' };
  }
};

export const useMastraInstanceStatus = (endpoint: string = 'http://localhost:4111') => {
  return useQuery({
    queryKey: ['mastra-instance-status', endpoint],
    queryFn: () => getMastraInstanceStatus(endpoint),
    retry: false,
  });
};

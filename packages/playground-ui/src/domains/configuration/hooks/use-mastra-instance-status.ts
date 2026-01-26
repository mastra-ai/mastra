import { useQuery } from '@tanstack/react-query';

export type UseMastraInstanceStatusResponse = {
  status: 'active' | 'inactive';
};

const getMastraInstanceStatus = async (
  endpoint: string = 'http://localhost:4111',
  prefix: string = '/api',
): Promise<UseMastraInstanceStatusResponse> => {
  try {
    // Check if the Mastra server is running by fetching the agents endpoint
    // We use the prefixed endpoint since MastraServer doesn't create a root route
    const url = `${endpoint}${prefix}/agents`;
    const response = await fetch(url);

    return { status: response.ok ? 'active' : 'inactive' };
  } catch {
    return { status: 'inactive' };
  }
};

export const useMastraInstanceStatus = (endpoint: string = 'http://localhost:4111', prefix: string = '/api') => {
  return useQuery({
    queryKey: ['mastra-instance-status', endpoint, prefix],
    queryFn: () => getMastraInstanceStatus(endpoint, prefix),
    retry: false,
  });
};

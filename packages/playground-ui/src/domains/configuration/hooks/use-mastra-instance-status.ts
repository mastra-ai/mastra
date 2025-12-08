import { useQuery } from '@tanstack/react-query';

export type UseMastraInstanceStatusResponse = {
  status: 'active' | 'inactive';
};

const getMastraInstanceStatus = async (
  endpoint: string = 'http://localhost:4111',
): Promise<UseMastraInstanceStatusResponse> => {
  const response = await fetch(endpoint);
  if (response.ok) {
    return { status: 'active' };
  } else {
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

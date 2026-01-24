import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Build {
  id: string;
  number: number;
  deploymentId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function useBuilds(deploymentId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['builds', deploymentId, params],
    queryFn: async (): Promise<PaginatedResponse<Build>> => {
      const url = new URL(`${ADMIN_API_URL}/deployments/${deploymentId}/builds`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch builds');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!deploymentId,
  });
}

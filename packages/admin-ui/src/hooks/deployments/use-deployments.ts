import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Deployment {
  id: string;
  name: string;
  slug: string;
  projectId: string;
  status: 'pending' | 'running' | 'stopped' | 'failed';
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function useDeployments(projectId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deployments', projectId, params],
    queryFn: async (): Promise<PaginatedResponse<Deployment>> => {
      const url = new URL(`${ADMIN_API_URL}/projects/${projectId}/deployments`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployments');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

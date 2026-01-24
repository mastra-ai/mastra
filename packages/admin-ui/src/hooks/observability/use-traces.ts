import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Trace {
  id: string;
  name: string;
  duration: number;
  status: 'ok' | 'error';
  timestamp: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function useTraces(projectId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['traces', projectId, params],
    queryFn: async (): Promise<PaginatedResponse<Trace>> => {
      const url = new URL(`${ADMIN_API_URL}/projects/${projectId}/traces`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch traces');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

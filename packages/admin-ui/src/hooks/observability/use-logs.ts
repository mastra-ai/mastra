import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function useLogs(projectId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['logs', projectId, params],
    queryFn: async (): Promise<PaginatedResponse<LogEntry>> => {
      const url = new URL(`${ADMIN_API_URL}/projects/${projectId}/logs`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

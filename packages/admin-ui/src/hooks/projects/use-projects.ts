import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Project {
  id: string;
  name: string;
  slug: string;
  teamId: string;
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

export function useProjects(teamId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['projects', teamId, params],
    queryFn: async (): Promise<PaginatedResponse<Project>> => {
      const url = new URL(`${ADMIN_API_URL}/teams/${teamId}/projects`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!teamId,
  });
}

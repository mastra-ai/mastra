import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Team {
  id: string;
  name: string;
  slug: string;
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

export function useTeams(params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['teams', params],
    queryFn: async (): Promise<PaginatedResponse<Team>> => {
      const url = new URL(`${ADMIN_API_URL}/teams`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      return response.json();
    },
    enabled: !!session?.access_token,
  });
}

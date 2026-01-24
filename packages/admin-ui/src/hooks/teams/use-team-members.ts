import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface TeamMember {
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member';
  user?: User;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function useTeamMembers(teamId: string, params?: { page?: number; perPage?: number }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['team-members', teamId, params],
    queryFn: async (): Promise<PaginatedResponse<TeamMember>> => {
      const url = new URL(`${ADMIN_API_URL}/teams/${teamId}/members`);
      if (params?.page) url.searchParams.set('page', String(params.page));
      if (params?.perPage) url.searchParams.set('perPage', String(params.perPage));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!teamId,
  });
}

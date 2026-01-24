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

export function useTeam(teamId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async (): Promise<Team> => {
      const response = await fetch(`${ADMIN_API_URL}/teams/${teamId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!teamId,
  });
}

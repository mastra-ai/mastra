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

export function useBuild(buildId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['build', buildId],
    queryFn: async (): Promise<Build> => {
      const response = await fetch(`${ADMIN_API_URL}/builds/${buildId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch build');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!buildId,
  });
}

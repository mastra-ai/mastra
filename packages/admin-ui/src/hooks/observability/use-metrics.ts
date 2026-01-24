import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface Metrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  p99Latency: number;
}

export function useMetrics(projectId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['metrics', projectId],
    queryFn: async (): Promise<Metrics> => {
      const response = await fetch(`${ADMIN_API_URL}/projects/${projectId}/metrics`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

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

export function useDeployment(deploymentId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: async (): Promise<Deployment> => {
      const response = await fetch(`${ADMIN_API_URL}/deployments/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployment');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!deploymentId,
  });
}

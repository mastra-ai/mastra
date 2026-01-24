import { useQuery } from '@tanstack/react-query';
import { ADMIN_API_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

interface EnvVar {
  key: string;
  value?: string;
  isSecret: boolean;
}

export function useEnvVars(projectId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['env-vars', projectId],
    queryFn: async (): Promise<EnvVar[]> => {
      const response = await fetch(`${ADMIN_API_URL}/projects/${projectId}/env-vars`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch environment variables');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

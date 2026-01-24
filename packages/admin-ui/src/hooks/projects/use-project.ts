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

export function useProject(projectId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<Project> => {
      const response = await fetch(`${ADMIN_API_URL}/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!projectId,
  });
}

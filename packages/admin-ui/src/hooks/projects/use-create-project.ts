import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface CreateProjectInput {
  teamId: string;
  name: string;
  slug?: string;
}

export function useCreateProject() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProjectInput): Promise<Project> => {
      const { teamId, ...body } = data;
      const response = await fetch(`${ADMIN_API_URL}/teams/${teamId}/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create project');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.teamId] });
    },
  });
}

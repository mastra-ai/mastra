import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface CreateDeploymentInput {
  projectId: string;
  name: string;
  slug?: string;
}

export function useCreateDeployment() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDeploymentInput): Promise<Deployment> => {
      const { projectId, ...body } = data;
      const response = await fetch(`${ADMIN_API_URL}/projects/${projectId}/deployments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create deployment');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', variables.projectId] });
    },
  });
}

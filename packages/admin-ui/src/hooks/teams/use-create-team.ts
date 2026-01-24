import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';

interface CreateTeamInput {
  name: string;
  slug?: string;
}

export function useCreateTeam() {
  const client = useAdminClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamInput) => client.teams.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

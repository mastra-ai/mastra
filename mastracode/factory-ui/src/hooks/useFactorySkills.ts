import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactorySkillResponse, FactorySkillsResponse, UpdateFactorySkillBody } from '../api/types';

/**
 * The catalog of Factory skills — the stage playbooks (triage, plan,
 * review, …) automated Factory runs follow, with any stored user
 * customizations applied. Mirrors `GET /web/factory/skills`.
 */
export function useFactorySkillsQuery() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySkills(),
    queryFn: () => client.get<FactorySkillsResponse>('/web/factory/skills'),
    select: data => data.skills,
  });
}

/** Save a customized description/body for a bundled skill. */
export function useUpdateFactorySkillMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...body }: UpdateFactorySkillBody & { name: string }) =>
      client.put<FactorySkillResponse>(`/web/factory/skills/${name}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factorySkills() }),
  });
}

/** Delete the stored customization, restoring the bundled default. */
export function useResetFactorySkillMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name }: { name: string }) => client.del<FactorySkillResponse>(`/web/factory/skills/${name}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factorySkills() }),
  });
}

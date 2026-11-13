import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactorySkillInfo, FactorySkillsResponse } from '../api/types';

/**
 * The catalog of Factory skills — the stage playbooks (triage, plan, review,
 * …) Factory runs follow and the app's own skills. With a Factory project it
 * shows that project's edits and whether the caller may edit them.
 * Mirrors `GET /web/factory/skills`.
 */
export function useFactorySkillsQuery(factoryProjectId?: string) {
  const { client } = useApiConfig();
  const query = factoryProjectId ? `?projectId=${encodeURIComponent(factoryProjectId)}` : '';
  return useQuery({
    queryKey: queryKeys.factorySkills(factoryProjectId),
    queryFn: () => client.get<FactorySkillsResponse>(`/web/factory/skills${query}`),
  });
}

async function sendSkillEdit(
  baseUrl: string,
  factoryProjectId: string,
  name: string,
  init: { method: 'PUT'; content: string } | { method: 'DELETE' },
): Promise<FactorySkillInfo> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/skills/${encodeURIComponent(name)}`,
    {
      method: init.method,
      credentials: 'include',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      ...(init.method === 'PUT' ? { body: JSON.stringify({ content: init.content }) } : {}),
    },
  );
  const body = (await res.json().catch(() => undefined)) as
    | { skill?: FactorySkillInfo; message?: string; error?: string }
    | undefined;
  if (!res.ok || !body?.skill) {
    throw new Error(body?.message ?? body?.error ?? `Request failed (${res.status})`);
  }
  return body.skill;
}

/** Save (`content`) or revert (`content: null`) a project's edit of one skill. */
export function useFactorySkillEditMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string | null }) =>
      sendSkillEdit(
        baseUrl,
        factoryProjectId!,
        name,
        content === null ? { method: 'DELETE' } : { method: 'PUT', content },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.factorySkills(factoryProjectId) }),
  });
}

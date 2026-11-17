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

/** Sends one write to a project's skills and returns the skill it leaves, or null when it deleted the skill. */
async function sendSkillWrite(
  baseUrl: string,
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, string>,
): Promise<FactorySkillInfo | null> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => undefined)) as
    | { skill?: FactorySkillInfo | null; message?: string; error?: string }
    | undefined;
  if (!res.ok || !json || json.skill === undefined) {
    throw new Error(json?.message ?? json?.error ?? `Request failed (${res.status})`);
  }
  return json.skill;
}

const skillsPath = (factoryProjectId: string) => `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/skills`;

/** Refreshes the skills, and the boards, whose phases flag a skill that is missing. */
function useInvalidateSkills(factoryProjectId: string | undefined) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.factorySkills(factoryProjectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.boardCatalog(factoryProjectId) }),
    ]);
}

/**
 * Save (`content`) or revert (`content: null`) a project's edit of one skill. For a skill the project created,
 * saving updates it and `content: null` deletes it.
 */
export function useFactorySkillEditMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateSkills(factoryProjectId);
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string | null }) =>
      sendSkillWrite(
        baseUrl,
        `${skillsPath(factoryProjectId!)}/${encodeURIComponent(name)}`,
        content === null ? 'DELETE' : 'PUT',
        content === null ? undefined : { content },
      ),
    onSuccess: invalidate,
  });
}

/** Creates a skill for one Factory project. Mirrors `POST /web/factory/projects/:id/skills`. */
export function useFactorySkillCreateMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateSkills(factoryProjectId);
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      sendSkillWrite(baseUrl, skillsPath(factoryProjectId!), 'POST', { name, content }),
    onSuccess: invalidate,
  });
}

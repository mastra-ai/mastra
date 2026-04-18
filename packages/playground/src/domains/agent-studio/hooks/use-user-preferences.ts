import type { AgentStudioPreferences, UpdateUserPreferencesParams, UserPreferencesResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

const PREFERENCES_QUERY_KEY = ['user-preferences'] as const;

const DEFAULT_AGENT_STUDIO: Required<Pick<AgentStudioPreferences, 'starredAgents' | 'starredSkills' | 'previewMode'>> &
  AgentStudioPreferences = {
  starredAgents: [],
  starredSkills: [],
  previewMode: false,
};

/**
 * Fetches and mutates the authenticated user's Agent Studio preferences.
 * Returns safe defaults when the user is unauthenticated so the caller can
 * render without branching.
 */
export const useUserPreferences = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();

  const query = useQuery<UserPreferencesResponse | null>({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: async () => {
      try {
        return await client.getUserPreferences();
      } catch (error) {
        // When auth is not configured or the user is anonymous the endpoint
        // returns 401; treat that as "no server-side prefs".
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403) return null;
        }
        throw error;
      }
    },
    enabled: !userLoading,
  });

  const agentStudio = useMemo<AgentStudioPreferences>(
    () => ({
      ...DEFAULT_AGENT_STUDIO,
      ...(query.data?.agentStudio ?? {}),
    }),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: (params: UpdateUserPreferencesParams) => client.updateUserPreferences(params),
    onSuccess: data => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, data);
    },
  });

  const update = useCallback(
    (patch: AgentStudioPreferences) =>
      mutation.mutateAsync({
        agentStudio: { ...agentStudio, ...patch },
      }),
    [agentStudio, mutation],
  );

  return {
    preferences: query.data,
    agentStudio,
    isLoading: query.isLoading || userLoading,
    isAuthenticated: !!user?.id,
    update,
    isUpdating: mutation.isPending,
    error: query.error,
  };
};

/**
 * Returns true/false plus a toggle callback for starring a library item.
 * Writes through to the server preferences document.
 */
export const useToggleStar = (kind: 'agent' | 'skill', id?: string) => {
  const { agentStudio, update, isAuthenticated } = useUserPreferences();

  const starredList = useMemo(
    () => (kind === 'agent' ? (agentStudio.starredAgents ?? []) : (agentStudio.starredSkills ?? [])),
    [agentStudio.starredAgents, agentStudio.starredSkills, kind],
  );
  const isStarred = !!id && starredList.includes(id);

  const toggle = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    const next = isStarred ? starredList.filter(entry => entry !== id) : [id, ...starredList];
    const patch: AgentStudioPreferences = kind === 'agent' ? { starredAgents: next } : { starredSkills: next };
    await update(patch);
  }, [id, isAuthenticated, isStarred, kind, starredList, update]);

  return { isStarred, toggle, canStar: isAuthenticated };
};

/** Narrow selectors over the preferences document. */
export const useStarredAgentIds = () => useUserPreferences().agentStudio.starredAgents ?? [];
export const useStarredSkillIds = () => useUserPreferences().agentStudio.starredSkills ?? [];

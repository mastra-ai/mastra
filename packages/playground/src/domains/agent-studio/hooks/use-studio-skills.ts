import type { ListStoredSkillsParams, StoredSkillResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export type StudioSkillScope = 'all' | 'mine' | 'team';

type UseStudioSkillsOptions = {
  scope?: StudioSkillScope;
  search?: string;
  perPage?: number;
};

export const useListStoredSkills = (params?: ListStoredSkillsParams) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['stored-skills', params],
    queryFn: () => client.listStoredSkills(params),
  });
};

export const useStoredSkill = (skillId?: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['stored-skill', skillId],
    queryFn: async () => {
      if (!skillId) return null;
      try {
        return await client.getStoredSkill(skillId).details();
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(skillId),
  });
};

export const useStudioSkills = ({ scope = 'all', search = '', perPage = 100 }: UseStudioSkillsOptions = {}) => {
  const { data: user } = useCurrentUser();
  const { data, isLoading, error } = useListStoredSkills({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage,
  });

  const skills: StoredSkillResponse[] = useMemo(() => data?.skills ?? [], [data]);

  const scoped = useMemo(() => {
    if (scope === 'all' || !user?.id) return skills;
    if (scope === 'mine') return skills.filter(s => s.authorId === user.id);
    return skills.filter(s => !s.authorId || s.authorId !== user.id);
  }, [skills, scope, user?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scoped;
    return scoped.filter(skill => {
      const name = (skill.name ?? '').toLowerCase();
      const description = (skill.description ?? '').toLowerCase();
      return name.includes(term) || description.includes(term);
    });
  }, [scoped, search]);

  return {
    skills: filtered,
    allSkills: skills,
    isLoading,
    error,
    currentUserId: user?.id,
  };
};

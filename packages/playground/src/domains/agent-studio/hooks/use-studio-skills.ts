import type {
  CreateStoredSkillParams,
  ListStoredSkillsParams,
  StoredSkillResponse,
  UpdateStoredSkillParams,
  VisibilityValue,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { resolveVisibility } from '../components/visibility';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

export type StudioSkillScope = 'all' | 'mine' | 'team';

type UseStudioSkillsOptions = {
  scope?: StudioSkillScope;
  search?: string;
  perPage?: number;
  /** When set, only skills whose resolved visibility matches are returned. */
  visibility?: VisibilityValue;
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

export const useStudioSkills = ({
  scope = 'all',
  search = '',
  perPage = 100,
  visibility,
}: UseStudioSkillsOptions = {}) => {
  const { data: user } = useCurrentUser();
  const { data, isLoading, error } = useListStoredSkills({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage,
  });

  const skills: StoredSkillResponse[] = useMemo(() => data?.skills ?? [], [data]);

  const scoped = useMemo(() => {
    const byScope =
      scope === 'all' || !user?.id
        ? skills
        : scope === 'mine'
          ? skills.filter(s => s.authorId === user.id)
          : skills.filter(s => !s.authorId || s.authorId !== user.id);
    if (!visibility) return byScope;
    return byScope.filter(s => (s.visibility ?? resolveVisibility(s.metadata)) === visibility);
  }, [skills, scope, user?.id, visibility]);

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

export const useStoredSkillMutations = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
    void queryClient.invalidateQueries({ queryKey: ['stored-skill'] });
  };

  const createStoredSkill = useMutation({
    mutationFn: (params: CreateStoredSkillParams) => client.createStoredSkill(params),
    onSuccess: invalidate,
  });

  const updateStoredSkill = useMutation({
    mutationFn: ({ skillId, params }: { skillId: string; params: UpdateStoredSkillParams }) =>
      client.getStoredSkill(skillId).update(params),
    onSuccess: invalidate,
  });

  const deleteStoredSkill = useMutation({
    mutationFn: (skillId: string) => client.getStoredSkill(skillId).delete(),
    onSuccess: invalidate,
  });

  return { createStoredSkill, updateStoredSkill, deleteStoredSkill };
};

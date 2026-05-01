import type { ListStoredSkillsParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useStoredSkills(params?: ListStoredSkillsParams, options?: { enabled?: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills', params],
    queryFn: () => client.listStoredSkills(params),
    enabled: options?.enabled ?? true,
  });
}

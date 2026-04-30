import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useStoredSkill(skillId: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skill', skillId],
    queryFn: () => client.getStoredSkill(skillId!).details(),
    enabled: !!skillId,
  });
}

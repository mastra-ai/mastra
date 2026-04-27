import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useStoredSkills(options?: { enabled?: boolean }) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills'],
    queryFn: () => client.listStoredSkills(),
    enabled: options?.enabled ?? true,
  });
}

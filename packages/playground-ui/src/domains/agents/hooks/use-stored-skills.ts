import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export function useStoredSkills() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills'],
    queryFn: () => client.listStoredSkills(),
  });
}

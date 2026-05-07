import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useStoredSkills() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills'],
    queryFn: () => client.listStoredSkills(),
  });
}

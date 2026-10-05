import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';

export type ListStoredSkillsResponse = Awaited<ReturnType<MastraClient['listStoredSkills']>>;

export function useStoredSkills(options?: { enabled?: boolean }): UseQueryResult<ListStoredSkillsResponse, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills'],
    queryFn: () => client.listStoredSkills(),
    enabled: options?.enabled !== false,
  });
}

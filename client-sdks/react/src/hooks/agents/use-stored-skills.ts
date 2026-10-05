import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export type ListStoredSkillsResponse = Awaited<ReturnType<MastraClient['listStoredSkills']>>;

export function useStoredSkills<TData = ListStoredSkillsResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ListStoredSkillsResponse, TData> } = {}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-skills'],
    queryFn: () => client.listStoredSkills(),
    ...queryOptions,
  });
}

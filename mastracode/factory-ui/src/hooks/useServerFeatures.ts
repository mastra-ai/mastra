import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export interface ServerFeatures {
  knowledge: boolean;
}

export function useServerFeatures() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.serverFeatures(),
    queryFn: () => client.get<ServerFeatures>('/web/config/features'),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

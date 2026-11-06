import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listConnectTools } from '../ui/domains/factory/services/platformConnect';

export function useConnectToolsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.connectTools(),
    queryFn: () => listConnectTools(baseUrl),
    retry: false,
  });
}

import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listConnectToolList, listConnectTools } from '../ui/domains/factory/services/platformConnect';

export function useConnectToolsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.connectTools(),
    queryFn: () => listConnectTools(baseUrl),
    retry: false,
  });
}

/** The tools sessions get from the Connect tools source, resolved as the signed-in user's session would. */
export function useConnectToolListQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.connectToolList(),
    queryFn: () => listConnectToolList(baseUrl),
    retry: false,
  });
}

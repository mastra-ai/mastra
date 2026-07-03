import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { fetchAuthState } from '../services/auth';

export function useWebAuth() {
  const { baseUrl } = useApiConfig();
  return useQuery({ queryKey: queryKeys.webAuth(), queryFn: () => fetchAuthState(baseUrl) });
}

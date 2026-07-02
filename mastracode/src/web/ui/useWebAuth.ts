import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../shared/api/keys';
import { fetchAuthState } from './auth';

export function useWebAuth() {
  return useQuery({ queryKey: queryKeys.webAuth(), queryFn: fetchAuthState });
}

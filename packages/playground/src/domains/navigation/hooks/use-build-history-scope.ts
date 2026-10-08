import { useMastraClient } from '@mastra/react';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { buildHistoryKey } from '../utils/build-resource-history';

/** Browser history belongs to the connected instance and signed-in account. */
export function useBuildHistoryScope() {
  const client = useMastraClient();
  const { data: auth } = useAuthCapabilities();
  if (!auth) return undefined;
  if (isAuthenticated(auth)) return buildHistoryKey(client.options.baseUrl, client.options.apiPrefix, auth.user.id);
  if (!auth.enabled) return buildHistoryKey(client.options.baseUrl, client.options.apiPrefix);
  return undefined;
}

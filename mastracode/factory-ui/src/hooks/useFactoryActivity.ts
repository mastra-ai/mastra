import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryActivity } from '../ui/domains/factory/services/activity';

/** How often the project's run activity is re-checked while the tab is focused. */
const ACTIVITY_POLL_MS = 5000;

/** Session ids of the project's runs currently in flight. */
export function useFactoryActivity(factoryProjectId: string | undefined): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const query = useQuery({
    queryKey: queryKeys.factoryActivity(factoryProjectId),
    queryFn: () => fetchFactoryActivity(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    refetchInterval: ACTIVITY_POLL_MS,
    retry: false,
  });
  const running = query.data;
  return useMemo(() => new Set(running ?? []), [running]);
}

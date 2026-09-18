import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listIncidentioFollowUpSources } from '../ui/domains/factory/services/incidentio';

export function useIncidentioSourcesQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.incidentioSources(),
    queryFn: () => listIncidentioFollowUpSources(baseUrl),
    enabled,
  });
}

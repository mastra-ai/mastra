import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { IntakeRouteListResponse } from '../api/types';

/** A Factory project's intake routes, in evaluation order. */
export function useIntakeRoutesQuery(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeRoutes(factoryProjectId),
    queryFn: factoryProjectId
      ? () =>
          client.get<IntakeRouteListResponse>(
            `/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake-routes`,
          )
      : skipToken,
    select: data => data.intakeRoutes,
  });
}

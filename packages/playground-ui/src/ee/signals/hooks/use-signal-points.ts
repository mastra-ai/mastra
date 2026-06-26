import { useQuery } from '@tanstack/react-query';
import { useMastraPlatform } from '../../../lib/mastra-platform/use-mastra-platform';
import type { EntityLearningPoint, PointsResponse } from '../types';
import { entityLearningFetch } from './entity-learning-fetch';

/**
 * Fetches the 2D projection points for a signal run, used by the scatter chart.
 */
export function useSignalPoints(
  entityId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
  includeOutliers = true,
) {
  const {
    mastraPlatformApiEndpoint,
    mastraPlatformObservabilityEndpoint,
    mastraOrganizationId,
    mastraPlatformProjectId,
  } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;
  const scope = { organizationId: mastraOrganizationId, projectId: mastraPlatformProjectId };

  return useQuery<EntityLearningPoint[]>({
    queryKey: [
      'entity-learning',
      'points',
      entityId,
      signalName,
      runId,
      includeOutliers,
      mastraOrganizationId,
      mastraPlatformProjectId,
    ],
    enabled: Boolean(endpoint) && Boolean(entityId) && Boolean(signalName) && Boolean(runId),
    retry: false,
    queryFn: async () => {
      const { points } = await entityLearningFetch<PointsResponse>(
        endpoint!,
        `/entities/${entityId}/points`,
        {
          signalName,
          runId,
          includeOutliers,
        },
        scope,
      );
      return points;
    },
  });
}

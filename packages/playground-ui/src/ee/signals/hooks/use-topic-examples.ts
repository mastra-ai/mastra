import { useQuery } from '@tanstack/react-query';
import { useMastraPlatform } from '../../../lib/mastra-platform/use-mastra-platform';
import type { EntityLearningExample, TopicExamplesResponse } from '../types';
import { entityLearningFetch } from './entity-learning-fetch';

/**
 * Fetches the example traces for a topic within a signal run.
 */
export function useTopicExamples(
  entityId: string | undefined,
  topicId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
) {
  const {
    mastraPlatformApiEndpoint,
    mastraPlatformObservabilityEndpoint,
    mastraOrganizationId,
    mastraPlatformProjectId,
  } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;
  const scope = { organizationId: mastraOrganizationId, projectId: mastraPlatformProjectId };

  return useQuery<EntityLearningExample[]>({
    queryKey: [
      'entity-learning',
      'topic-examples',
      entityId,
      topicId,
      signalName,
      runId,
      mastraOrganizationId,
      mastraPlatformProjectId,
    ],
    enabled: Boolean(endpoint) && Boolean(entityId) && Boolean(topicId) && Boolean(signalName) && Boolean(runId),
    retry: false,
    queryFn: async () => {
      const { examples } = await entityLearningFetch<TopicExamplesResponse>(
        endpoint!,
        `/entities/${entityId}/topics/${topicId}/examples`,
        { signalName, runId },
        scope,
      );
      return examples;
    },
  });
}

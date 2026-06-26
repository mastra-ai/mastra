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
  const { mastraPlatformApiEndpoint, mastraPlatformObservabilityEndpoint } = useMastraPlatform();
  const endpoint = mastraPlatformObservabilityEndpoint ?? mastraPlatformApiEndpoint;

  return useQuery<EntityLearningExample[]>({
    queryKey: ['entity-learning', 'topic-examples', entityId, topicId, signalName, runId],
    enabled: Boolean(endpoint) && Boolean(entityId) && Boolean(topicId) && Boolean(signalName) && Boolean(runId),
    retry: false,
    queryFn: async () => {
      const { examples } = await entityLearningFetch<TopicExamplesResponse>(
        endpoint!,
        `/entities/${entityId}/topics/${topicId}/examples`,
        { signalName, runId },
      );
      return examples;
    },
  });
}

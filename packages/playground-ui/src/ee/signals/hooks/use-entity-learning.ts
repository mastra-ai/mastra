import { skipToken, useQuery } from '@tanstack/react-query';
import type { EntityLearningTopicExamplesParams, EntityLearningOutlierExamplesParams } from '../services';
import { useEntityLearningConfig } from './use-entity-learning-config';

const KEY = 'entity-learning';

/** GET /entity-learning/entities */
export function useEntities() {
  const { service, isConfigured } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'entities'],
    queryFn: isConfigured && service ? () => service.getEntities() : skipToken,
    select: data => data.entities,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/runs?signalName= */
export function useEntityRuns(entityId: string | undefined, signalName: string | undefined) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'runs', entityId, signalName],
    queryFn: service && entityId && signalName ? () => service.getEntityRuns(entityId, signalName) : skipToken,
    select: data => data.runs,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/runs/:runId?signalName= */
export function useEntityRun(entityId: string | undefined, runId: string | undefined, signalName: string | undefined) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'run', entityId, runId, signalName],
    queryFn:
      service && entityId && runId && signalName ? () => service.getEntityRun(entityId, runId, signalName) : skipToken,
    select: data => data.run,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/learning?signalName=&runId? */
export function useEntityLearning(entityId: string | undefined, signalName: string | undefined, runId?: string) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'learning', entityId, signalName, runId ?? null],
    queryFn:
      service && entityId && signalName ? () => service.getEntityLearning(entityId, signalName, runId) : skipToken,
    select: data => data.learning,
    retry: false,
  });
}

/**
 * GET /entity-learning/entities/:entityId/topics?signalName=&runId? — the clusters.
 * Omit `runId` to let the API resolve the latest run for that signal — an
 * entity-level `latestRunId` belongs to a single signal and must not be
 * reused across signals.
 */
export function useEntityTopics(entityId: string | undefined, signalName: string | undefined, runId?: string) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'topics', entityId, signalName, runId ?? 'latest'],
    queryFn: service && entityId && signalName ? () => service.getEntityTopics(entityId, signalName, runId) : skipToken,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/topics/:topicId?signalName=&runId= */
export function useEntityTopic(
  entityId: string | undefined,
  topicId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'topic', entityId, topicId, signalName, runId],
    queryFn:
      service && entityId && topicId && signalName && runId
        ? () => service.getEntityTopic(entityId, topicId, signalName, runId)
        : skipToken,
    select: data => data.topic,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/topics/:topicId/examples?signalName=&runId=&limit= */
export function useEntityTopicExamples(
  entityId: string | undefined,
  topicId: string | undefined,
  params: EntityLearningTopicExamplesParams | undefined,
) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'topic-examples', entityId, topicId, params?.signalName, params?.runId, params?.limit ?? null],
    queryFn:
      service && entityId && topicId && params?.signalName && params?.runId
        ? () => service.getEntityTopicExamples(entityId, topicId, params)
        : skipToken,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/outliers?signalName=&runId= */
export function useEntityOutliers(
  entityId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'outliers', entityId, signalName, runId],
    queryFn:
      service && entityId && signalName && runId
        ? () => service.getEntityOutliers(entityId, signalName, runId)
        : skipToken,
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/outliers/examples?signalName=&runId=&limit= */
export function useEntityOutlierExamples(
  entityId: string | undefined,
  params: EntityLearningOutlierExamplesParams | undefined,
) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'outlier-examples', entityId, params?.signalName, params?.runId, params?.limit ?? null],
    queryFn:
      service && entityId && params?.signalName && params?.runId
        ? () => service.getEntityOutlierExamples(entityId, params)
        : skipToken,
    retry: false,
  });
}

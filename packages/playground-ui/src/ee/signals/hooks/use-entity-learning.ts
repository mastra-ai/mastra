import { useQuery } from '@tanstack/react-query';
import type {
  EntityLearningPointsParams,
  EntityLearningTopicExamplesParams,
  EntityLearningOutlierExamplesParams,
} from '../services';
import { useEntityLearningConfig } from './use-entity-learning-config';

const KEY = 'entity-learning';

/** GET /entity-learning/entities */
export function useEntities() {
  const { service, isConfigured } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'entities'],
    queryFn: () => service!.getEntities(),
    select: data => data.entities,
    enabled: isConfigured && Boolean(service),
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/runs?signalName= */
export function useEntityRuns(entityId: string | undefined, signalName: string | undefined) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'runs', entityId, signalName],
    queryFn: () => service!.getEntityRuns(entityId!, signalName!),
    select: data => data.runs,
    enabled: Boolean(service && entityId && signalName),
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/runs/:runId?signalName= */
export function useEntityRun(entityId: string | undefined, runId: string | undefined, signalName: string | undefined) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'run', entityId, runId, signalName],
    queryFn: () => service!.getEntityRun(entityId!, runId!, signalName!),
    select: data => data.run,
    enabled: Boolean(service && entityId && runId && signalName),
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/learning?signalName=&runId? */
export function useEntityLearning(entityId: string | undefined, signalName: string | undefined, runId?: string) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'learning', entityId, signalName, runId ?? null],
    queryFn: () => service!.getEntityLearning(entityId!, signalName!, runId),
    select: data => data.learning,
    enabled: Boolean(service && entityId && signalName),
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/topics?signalName=&runId= — the clusters. */
export function useEntityTopics(
  entityId: string | undefined,
  signalName: string | undefined,
  runId: string | undefined,
) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [KEY, 'topics', entityId, signalName, runId],
    queryFn: () => service!.getEntityTopics(entityId!, signalName!, runId!),
    enabled: Boolean(service && entityId && signalName && runId),
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
    queryFn: () => service!.getEntityTopic(entityId!, topicId!, signalName!, runId!),
    select: data => data.topic,
    enabled: Boolean(service && entityId && topicId && signalName && runId),
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
    queryFn: () => service!.getEntityTopicExamples(entityId!, topicId!, params!),
    enabled: Boolean(service && entityId && topicId && params?.signalName && params?.runId),
    retry: false,
  });
}

/** GET /entity-learning/entities/:entityId/points?signalName=&runId=&includeOutliers=&limit= */
export function useEntityPoints(entityId: string | undefined, params: EntityLearningPointsParams | undefined) {
  const { service } = useEntityLearningConfig();

  return useQuery({
    queryKey: [
      KEY,
      'points',
      entityId,
      params?.signalName,
      params?.runId,
      params?.includeOutliers ?? null,
      params?.limit ?? null,
    ],
    queryFn: () => service!.getEntityPoints(entityId!, params!),
    enabled: Boolean(service && entityId && params?.signalName && params?.runId),
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
    queryFn: () => service!.getEntityOutliers(entityId!, signalName!, runId!),
    enabled: Boolean(service && entityId && signalName && runId),
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
    queryFn: () => service!.getEntityOutlierExamples(entityId!, params!),
    enabled: Boolean(service && entityId && params?.signalName && params?.runId),
    retry: false,
  });
}

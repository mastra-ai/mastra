import type {
  EntityLearningEntitiesResponse,
  EntityLearningRunsResponse,
  EntityLearningRunResponse,
  EntityLearningLearningResponse,
  EntityLearningTopicsResponse,
  EntityLearningTopicResponse,
  EntityLearningTopicExamplesResponse,
  EntityLearningPointsResponse,
  EntityLearningOutliersResponse,
} from './entity-learning-types';

export type EntityLearningServiceConfig = {
  /** Platform observability endpoint, e.g. `https://observability.mastra.ai`. */
  baseUrl: string;
  organizationId?: string;
  projectId?: string;
};

export type EntityLearningTopicExamplesParams = {
  signalName: string;
  runId: string;
  limit?: number;
};

export type EntityLearningPointsParams = {
  signalName: string;
  runId: string;
  includeOutliers?: boolean;
  limit?: number;
};

export type EntityLearningOutlierExamplesParams = {
  signalName: string;
  runId: string;
  limit?: number;
};

export type EntityLearningService = ReturnType<typeof createEntityLearningService>;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * Network layer for the platform Entity-Learning API. The base URL is the
 * observability endpoint; every route is scoped under `/entity-learning`.
 */
export function createEntityLearningService(config: EntityLearningServiceConfig) {
  const root = `${trimTrailingSlash(config.baseUrl)}/entity-learning`;

  const buildUrl = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
    const url = new URL(`${root}${path}`);
    if (config.organizationId) {
      url.searchParams.set('organizationId', config.organizationId);
    }
    if (config.projectId) {
      url.searchParams.set('projectId', config.projectId);
    }
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  };

  async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Entity-Learning request failed (${res.status}): ${url}`);
    }
    return (await res.json()) as T;
  }

  const encode = (segment: string) => encodeURIComponent(segment);

  return {
    getEntities() {
      return getJson<EntityLearningEntitiesResponse>(buildUrl('/entities'));
    },

    getEntityRuns(entityId: string, signalName: string) {
      return getJson<EntityLearningRunsResponse>(buildUrl(`/entities/${encode(entityId)}/runs`, { signalName }));
    },

    getEntityRun(entityId: string, runId: string, signalName: string) {
      return getJson<EntityLearningRunResponse>(
        buildUrl(`/entities/${encode(entityId)}/runs/${encode(runId)}`, { signalName }),
      );
    },

    getEntityLearning(entityId: string, signalName: string, runId?: string) {
      return getJson<EntityLearningLearningResponse>(
        buildUrl(`/entities/${encode(entityId)}/learning`, { signalName, runId }),
      );
    },

    getEntityTopics(entityId: string, signalName: string, runId: string) {
      return getJson<EntityLearningTopicsResponse>(
        buildUrl(`/entities/${encode(entityId)}/topics`, { signalName, runId }),
      );
    },

    getEntityTopic(entityId: string, topicId: string, signalName: string, runId: string) {
      return getJson<EntityLearningTopicResponse>(
        buildUrl(`/entities/${encode(entityId)}/topics/${encode(topicId)}`, { signalName, runId }),
      );
    },

    getEntityTopicExamples(entityId: string, topicId: string, params: EntityLearningTopicExamplesParams) {
      return getJson<EntityLearningTopicExamplesResponse>(
        buildUrl(`/entities/${encode(entityId)}/topics/${encode(topicId)}/examples`, {
          signalName: params.signalName,
          runId: params.runId,
          limit: params.limit,
        }),
      );
    },

    getEntityPoints(entityId: string, params: EntityLearningPointsParams) {
      return getJson<EntityLearningPointsResponse>(
        buildUrl(`/entities/${encode(entityId)}/points`, {
          signalName: params.signalName,
          runId: params.runId,
          includeOutliers: params.includeOutliers,
          limit: params.limit,
        }),
      );
    },

    getEntityOutliers(entityId: string, signalName: string, runId: string) {
      return getJson<EntityLearningOutliersResponse>(
        buildUrl(`/entities/${encode(entityId)}/outliers`, { signalName, runId }),
      );
    },

    getEntityOutlierExamples(entityId: string, params: EntityLearningOutlierExamplesParams) {
      return getJson<EntityLearningTopicExamplesResponse>(
        buildUrl(`/entities/${encode(entityId)}/outliers/examples`, {
          signalName: params.signalName,
          runId: params.runId,
          limit: params.limit,
        }),
      );
    },
  };
}

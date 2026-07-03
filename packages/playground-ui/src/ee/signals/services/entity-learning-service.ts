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
  /**
   * Platform observability query-service origin (mobs-query), e.g.
   * `https://observability.mastra.ai`. Agent Learning routes are served
   * session-authenticated under `/api/learning` on this origin — the same
   * origin and auth model as the `/api/observability/*` routes.
   */
  baseUrl: string;
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

// Index scan instead of regex to avoid backtracking (CodeQL js/polynomial-redos)
const trimTrailingSlash = (value: string) => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end--;
  return value.slice(0, end);
};

/**
 * Network layer for the platform Agent Learning API served by the
 * observability query service (mobs-query) under `/api/learning`.
 *
 * Auth follows the observability pattern: the WorkOS session cookie is sent
 * via `credentials: 'include'`, and the org/project scope is resolved
 * server-side from the session. `projectId` is passed as the
 * `X-Mastra-Project-Id` header so the server scopes reads to that project;
 * caller-supplied scope can never widen access beyond the session.
 */
export function createEntityLearningService(config: EntityLearningServiceConfig) {
  const root = `${trimTrailingSlash(config.baseUrl)}/api/learning`;

  const buildUrl = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
    const url = new URL(`${root}${path}`);
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
    const res = await fetch(url, {
      credentials: 'include',
      headers: config.projectId ? { 'X-Mastra-Project-Id': config.projectId } : undefined,
    });
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

    getEntityTopics(entityId: string, signalName: string, runId?: string) {
      // runId omitted → the API resolves the latest run for that signal.
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

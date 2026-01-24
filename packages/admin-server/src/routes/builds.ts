import type { AdminServerContext, AdminServerRoute } from '../types';
import {
  deploymentIdParamSchema,
  buildIdParamSchema,
  successResponseSchema,
} from '../schemas/common';
import {
  buildResponseSchema,
  buildLogsResponseSchema,
  listBuildsQuerySchema,
  getBuildLogsQuerySchema,
} from '../schemas/builds';

/**
 * Helper to convert build to response format.
 */
function toBuildResponse(build: {
  id: string;
  deploymentId: string;
  trigger: string;
  triggeredBy: string;
  commitSha: string;
  commitMessage: string | null;
  status: string;
  logs: string;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}) {
  return {
    id: build.id,
    deploymentId: build.deploymentId,
    trigger: build.trigger,
    triggeredBy: build.triggeredBy,
    commitSha: build.commitSha,
    commitMessage: build.commitMessage,
    status: build.status,
    queuedAt: build.queuedAt.toISOString(),
    startedAt: build.startedAt?.toISOString() ?? null,
    completedAt: build.completedAt?.toISOString() ?? null,
    errorMessage: build.errorMessage,
  };
}

/**
 * GET /deployments/:deploymentId/builds - List builds.
 */
export const LIST_BUILDS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/deployments/:deploymentId/builds',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  queryParamSchema: listBuildsQuerySchema,
  summary: 'List builds',
  description: 'List all builds for a deployment',
  tags: ['Builds'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId, page, limit } = params as AdminServerContext & {
      deploymentId: string;
      page?: number;
      limit?: number;
    };
    const result = await admin.listBuilds(userId, deploymentId, { page, perPage: limit });
    return {
      data: result.data.map(toBuildResponse),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  },
};

/**
 * GET /builds/:buildId - Get build details.
 */
export const GET_BUILD_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/builds/:buildId',
  responseType: 'json',
  pathParamSchema: buildIdParamSchema,
  responseSchema: buildResponseSchema,
  summary: 'Get build',
  description: 'Get details of a specific build',
  tags: ['Builds'],
  handler: async params => {
    const { admin, userId } = params;
    const { buildId } = params as AdminServerContext & { buildId: string };
    const build = await admin.getBuild(userId, buildId);
    if (!build) {
      throw new Error('Build not found');
    }
    return toBuildResponse(build);
  },
};

/**
 * GET /builds/:buildId/logs - Get build logs.
 * Supports streaming via Accept header or query param.
 */
export const GET_BUILD_LOGS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/builds/:buildId/logs',
  responseType: 'json', // Can be overridden to 'stream' based on Accept header
  pathParamSchema: buildIdParamSchema,
  queryParamSchema: getBuildLogsQuerySchema,
  responseSchema: buildLogsResponseSchema,
  summary: 'Get build logs',
  description: 'Get build logs. Set stream=true for SSE streaming.',
  tags: ['Builds'],
  handler: async params => {
    const { admin, userId } = params;
    const { buildId, stream, since } = params as AdminServerContext & {
      buildId: string;
      stream?: boolean;
      since?: number;
    };
    const build = await admin.getBuild(userId, buildId);
    if (!build) {
      throw new Error('Build not found');
    }

    // For streaming, this would be handled differently via WebSocket or SSE
    // For now, return the full logs
    const logs = since !== undefined
      ? build.logs.substring(since)
      : build.logs;

    const isComplete = ['succeeded', 'failed', 'cancelled'].includes(build.status);

    return {
      buildId: build.id,
      logs,
      complete: isComplete,
    };
  },
};

/**
 * POST /builds/:buildId/cancel - Cancel build.
 */
export const CANCEL_BUILD_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/builds/:buildId/cancel',
  responseType: 'json',
  pathParamSchema: buildIdParamSchema,
  responseSchema: successResponseSchema,
  summary: 'Cancel build',
  description: 'Cancel a queued or running build',
  tags: ['Builds'],
  handler: async params => {
    const { admin, userId } = params;
    const { buildId } = params as AdminServerContext & { buildId: string };
    await admin.cancelBuild(userId, buildId);
    return { success: true };
  },
};

/**
 * All build routes.
 */
export const BUILD_ROUTES: AdminServerRoute[] = [
  LIST_BUILDS_ROUTE,
  GET_BUILD_ROUTE,
  GET_BUILD_LOGS_ROUTE,
  CANCEL_BUILD_ROUTE,
];

import type { Deployment, Build } from '@mastra/admin';
import type { AdminServerContext, AdminServerRoute } from '../types';
import {
  projectIdParamSchema,
  deploymentIdParamSchema,
  successResponseSchema,
} from '../schemas/common';
import {
  deploymentResponseSchema,
  createDeploymentBodySchema,
  updateDeploymentBodySchema,
  triggerDeployBodySchema,
  rollbackBodySchema,
  listDeploymentsQuerySchema,
} from '../schemas/deployments';
import { buildResponseSchema } from '../schemas/builds';

/**
 * Helper to convert deployment to response format.
 */
function toDeploymentResponse(deployment: Deployment) {
  return {
    id: deployment.id,
    projectId: deployment.projectId,
    type: deployment.type,
    branch: deployment.branch,
    slug: deployment.slug,
    status: deployment.status,
    currentBuildId: deployment.currentBuildId,
    publicUrl: deployment.publicUrl,
    internalHost: deployment.internalHost,
    envVarOverrides: deployment.envVarOverrides.map(e => ({
      key: e.key,
      isSecret: e.isSecret,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    autoShutdown: deployment.autoShutdown,
    expiresAt: deployment.expiresAt?.toISOString() ?? null,
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
  };
}

/**
 * Helper to convert build to response format.
 */
function toBuildResponse(build: Build) {
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
 * GET /projects/:projectId/deployments - List deployments.
 */
export const LIST_DEPLOYMENTS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/deployments',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: listDeploymentsQuerySchema,
  summary: 'List deployments',
  description: 'List all deployments for a project',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, page, limit } = params as AdminServerContext & {
      projectId: string;
      page?: number;
      limit?: number;
    };
    const result = await admin.listDeployments(userId, projectId, { page, perPage: limit });
    return {
      data: result.data.map(toDeploymentResponse),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  },
};

/**
 * POST /projects/:projectId/deployments - Create deployment.
 */
export const CREATE_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/projects/:projectId/deployments',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  bodySchema: createDeploymentBodySchema,
  responseSchema: deploymentResponseSchema,
  summary: 'Create deployment',
  description: 'Create a new deployment for a project',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, type, branch, slug, envVarOverrides, autoShutdown } = params as AdminServerContext & {
      projectId: string;
      type: string;
      branch: string;
      slug?: string;
      envVarOverrides?: Record<string, string>;
      autoShutdown?: boolean;
    };
    const deployment = await admin.createDeployment(userId, projectId, {
      type: type as 'production' | 'staging' | 'preview',
      branch,
      slug,
      envVarOverrides,
      autoShutdown,
    });
    return toDeploymentResponse(deployment);
  },
};

/**
 * GET /deployments/:deploymentId - Get deployment details.
 */
export const GET_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/deployments/:deploymentId',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  responseSchema: deploymentResponseSchema,
  summary: 'Get deployment',
  description: 'Get details of a specific deployment',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId } = params as AdminServerContext & { deploymentId: string };
    const deployment = await admin.getDeployment(userId, deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }
    return toDeploymentResponse(deployment);
  },
};

/**
 * PATCH /deployments/:deploymentId - Update deployment.
 */
export const UPDATE_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'PATCH',
  path: '/deployments/:deploymentId',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  bodySchema: updateDeploymentBodySchema,
  responseSchema: deploymentResponseSchema,
  summary: 'Update deployment',
  description: 'Update deployment configuration',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId, autoShutdown } = params as AdminServerContext & {
      deploymentId: string;
      autoShutdown?: boolean;
    };
    const deployment = await admin.getDeployment(userId, deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const storage = admin.getStorage();
    const updated = await storage.updateDeployment(deploymentId, {
      autoShutdown: autoShutdown ?? deployment.autoShutdown,
    });

    return toDeploymentResponse(updated);
  },
};

/**
 * DELETE /deployments/:deploymentId - Delete deployment.
 */
export const DELETE_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/deployments/:deploymentId',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  responseSchema: successResponseSchema,
  summary: 'Delete deployment',
  description: 'Delete a deployment and stop any running servers',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId } = params as AdminServerContext & { deploymentId: string };
    const deployment = await admin.getDeployment(userId, deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Stop if running
    if (deployment.status === 'running') {
      await admin.stop(userId, deploymentId);
    }

    const storage = admin.getStorage();
    await storage.deleteDeployment(deploymentId);

    return { success: true };
  },
};

/**
 * POST /deployments/:deploymentId/deploy - Trigger deploy.
 */
export const TRIGGER_DEPLOY_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/deployments/:deploymentId/deploy',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  bodySchema: triggerDeployBodySchema,
  responseSchema: buildResponseSchema,
  summary: 'Trigger deploy',
  description: 'Trigger a new build and deployment',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId, commitSha, commitMessage } = params as AdminServerContext & {
      deploymentId: string;
      commitSha?: string;
      commitMessage?: string;
    };
    const build = await admin.deploy(userId, deploymentId, {
      trigger: 'manual',
      commitSha,
      commitMessage,
    });
    return toBuildResponse(build);
  },
};

/**
 * POST /deployments/:deploymentId/stop - Stop deployment.
 */
export const STOP_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/deployments/:deploymentId/stop',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  responseSchema: successResponseSchema,
  summary: 'Stop deployment',
  description: 'Stop a running deployment',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId } = params as AdminServerContext & { deploymentId: string };
    await admin.stop(userId, deploymentId);
    return { success: true };
  },
};

/**
 * POST /deployments/:deploymentId/restart - Restart deployment.
 */
export const RESTART_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/deployments/:deploymentId/restart',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  responseSchema: buildResponseSchema,
  summary: 'Restart deployment',
  description: 'Stop and redeploy using the current build',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId } = params as AdminServerContext & { deploymentId: string };

    // Stop current deployment
    await admin.stop(userId, deploymentId);

    // Get the current build ID
    const deployment = await admin.getDeployment(userId, deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Trigger a new deploy
    const build = await admin.deploy(userId, deploymentId, {
      trigger: 'manual',
    });

    return toBuildResponse(build);
  },
};

/**
 * POST /deployments/:deploymentId/rollback - Rollback to previous build.
 */
export const ROLLBACK_DEPLOYMENT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/deployments/:deploymentId/rollback',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  bodySchema: rollbackBodySchema,
  responseSchema: buildResponseSchema,
  summary: 'Rollback deployment',
  description: 'Rollback to a previous build',
  tags: ['Deployments'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId, buildId } = params as AdminServerContext & {
      deploymentId: string;
      buildId: string;
    };
    const build = await admin.rollback(userId, deploymentId, buildId);
    return toBuildResponse(build);
  },
};

/**
 * All deployment routes.
 */
export const DEPLOYMENT_ROUTES: AdminServerRoute[] = [
  LIST_DEPLOYMENTS_ROUTE,
  CREATE_DEPLOYMENT_ROUTE,
  GET_DEPLOYMENT_ROUTE,
  UPDATE_DEPLOYMENT_ROUTE,
  DELETE_DEPLOYMENT_ROUTE,
  TRIGGER_DEPLOY_ROUTE,
  STOP_DEPLOYMENT_ROUTE,
  RESTART_DEPLOYMENT_ROUTE,
  ROLLBACK_DEPLOYMENT_ROUTE,
];

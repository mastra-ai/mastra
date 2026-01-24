import type { Project, LocalSourceConfig, GitHubSourceConfig } from '@mastra/admin';
import type { AdminServerContext, AdminServerRoute } from '../types';
import {
  teamIdParamSchema,
  projectIdParamSchema,
  tokenIdParamSchema,
  envVarKeyParamSchema,
  successResponseSchema,
} from '../schemas/common';
import {
  projectResponseSchema,
  createProjectBodySchema,
  updateProjectBodySchema,
  setEnvVarBodySchema,
  encryptedEnvVarResponseSchema,
  projectApiTokenResponseSchema,
  createApiTokenBodySchema,
  createApiTokenResponseSchema,
  listProjectsQuerySchema,
  listEnvVarsQuerySchema,
  listApiTokensQuerySchema,
} from '../schemas/projects';

/**
 * Helper to convert project to response format.
 */
function toProjectResponse(project: Project) {
  return {
    id: project.id,
    teamId: project.teamId,
    name: project.name,
    slug: project.slug,
    sourceType: project.sourceType,
    sourceConfig: project.sourceConfig as unknown as Record<string, unknown>,
    defaultBranch: project.defaultBranch,
    envVars: project.envVars.map(e => ({
      key: e.key,
      isSecret: e.isSecret,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * GET /teams/:teamId/projects - List team's projects.
 */
export const LIST_PROJECTS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams/:teamId/projects',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  queryParamSchema: listProjectsQuerySchema,
  summary: 'List projects',
  description: 'List all projects in a team',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { teamId, page, limit } = params as AdminServerContext & {
      teamId: string;
      page?: number;
      limit?: number;
    };
    const result = await admin.listProjects(userId, teamId, { page, perPage: limit });
    return {
      data: result.data.map(toProjectResponse),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  },
};

/**
 * POST /teams/:teamId/projects - Create project.
 */
export const CREATE_PROJECT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/teams/:teamId/projects',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  bodySchema: createProjectBodySchema,
  responseSchema: projectResponseSchema,
  summary: 'Create project',
  description: 'Create a new project in a team',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { teamId, name, slug, sourceType, sourceConfig, defaultBranch } = params as AdminServerContext & {
      teamId: string;
      name: string;
      slug: string;
      sourceType: string;
      sourceConfig: LocalSourceConfig | GitHubSourceConfig;
      defaultBranch?: string;
    };
    const project = await admin.createProject(userId, teamId, {
      name,
      slug,
      sourceType: sourceType as 'local' | 'github',
      sourceConfig: sourceConfig as unknown as Record<string, unknown>,
      defaultBranch,
    });
    return toProjectResponse(project);
  },
};

/**
 * GET /projects/:projectId - Get project details.
 */
export const GET_PROJECT_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  responseSchema: projectResponseSchema,
  summary: 'Get project',
  description: 'Get details of a specific project',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId } = params as AdminServerContext & { projectId: string };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    return toProjectResponse(project);
  },
};

/**
 * PATCH /projects/:projectId - Update project.
 */
export const UPDATE_PROJECT_ROUTE: AdminServerRoute = {
  method: 'PATCH',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  bodySchema: updateProjectBodySchema,
  responseSchema: projectResponseSchema,
  summary: 'Update project',
  description: 'Update project name, branch, or source config',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, name, defaultBranch, sourceConfig } = params as AdminServerContext & {
      projectId: string;
      name?: string;
      defaultBranch?: string;
      sourceConfig?: LocalSourceConfig | GitHubSourceConfig;
    };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const storage = admin.getStorage();
    const updated = await storage.updateProject(projectId, {
      name: name ?? project.name,
      defaultBranch: defaultBranch ?? project.defaultBranch,
      sourceConfig: sourceConfig ?? project.sourceConfig,
    });

    return toProjectResponse(updated);
  },
};

/**
 * DELETE /projects/:projectId - Delete project.
 */
export const DELETE_PROJECT_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  responseSchema: successResponseSchema,
  summary: 'Delete project',
  description: 'Delete a project and all its deployments',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId } = params as AdminServerContext & { projectId: string };
    await admin.deleteProject(userId, projectId);
    return { success: true };
  },
};

/**
 * GET /projects/:projectId/env-vars - List environment variables.
 */
export const LIST_ENV_VARS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/env-vars',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: listEnvVarsQuerySchema,
  summary: 'List environment variables',
  description: 'List all environment variables for a project',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId } = params as AdminServerContext & { projectId: string };
    const envVars = await admin.getEnvVars(userId, projectId);
    return {
      data: envVars.map(e => ({
        key: e.key,
        isSecret: e.isSecret,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    };
  },
};

/**
 * POST /projects/:projectId/env-vars - Set environment variable.
 */
export const SET_ENV_VAR_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/projects/:projectId/env-vars',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  bodySchema: setEnvVarBodySchema,
  responseSchema: encryptedEnvVarResponseSchema,
  summary: 'Set environment variable',
  description: 'Create or update an environment variable',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, key, value, isSecret } = params as AdminServerContext & {
      projectId: string;
      key: string;
      value: string;
      isSecret?: boolean;
    };
    const envVar = await admin.setEnvVar(userId, projectId, key, value, isSecret ?? false);
    return {
      key: envVar.key,
      isSecret: envVar.isSecret,
      createdAt: envVar.createdAt.toISOString(),
      updatedAt: envVar.updatedAt.toISOString(),
    };
  },
};

/**
 * DELETE /projects/:projectId/env-vars/:key - Delete environment variable.
 */
export const DELETE_ENV_VAR_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/projects/:projectId/env-vars/:key',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema.merge(envVarKeyParamSchema),
  responseSchema: successResponseSchema,
  summary: 'Delete environment variable',
  description: 'Delete an environment variable',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, key } = params as AdminServerContext & { projectId: string; key: string };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const storage = admin.getStorage();
    await storage.deleteProjectEnvVar(projectId, key);

    return { success: true };
  },
};

/**
 * GET /projects/:projectId/api-tokens - List API tokens.
 */
export const LIST_API_TOKENS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/projects/:projectId/api-tokens',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  queryParamSchema: listApiTokensQuerySchema,
  summary: 'List API tokens',
  description: 'List all API tokens for a project',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId } = params as AdminServerContext & {
      projectId: string;
    };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const storage = admin.getStorage();
    // listProjectApiTokens does not take pagination params
    const tokens = await storage.listProjectApiTokens(projectId);

    return {
      data: tokens.map(token => ({
        id: token.id,
        projectId: token.projectId,
        name: token.name,
        tokenPrefix: token.tokenPrefix,
        scopes: token.scopes,
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        expiresAt: token.expiresAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
      })),
      total: tokens.length,
      page: 1,
      perPage: tokens.length,
      hasMore: false,
    };
  },
};

/**
 * POST /projects/:projectId/api-tokens - Create API token.
 */
export const CREATE_API_TOKEN_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/projects/:projectId/api-tokens',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema,
  bodySchema: createApiTokenBodySchema,
  responseSchema: createApiTokenResponseSchema,
  summary: 'Create API token',
  description: 'Create a new API token for the project',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, name, scopes, expiresInDays } = params as AdminServerContext & {
      projectId: string;
      name: string;
      scopes: string[];
      expiresInDays?: number;
    };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const storage = admin.getStorage();

    // Generate token
    const tokenValue = `mst_${crypto.randomUUID().replace(/-/g, '')}`;
    const tokenPrefix = tokenValue.substring(0, 10);

    // Hash the token for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenValue);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const token = await storage.createProjectApiToken({
      id: crypto.randomUUID(),
      projectId,
      name,
      tokenPrefix,
      tokenHash,
      scopes,
      expiresAt,
    });

    return {
      id: token.id,
      projectId: token.projectId,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      scopes: token.scopes,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      token: tokenValue, // Only returned on creation
    };
  },
};

/**
 * DELETE /projects/:projectId/api-tokens/:tokenId - Revoke API token.
 */
export const REVOKE_API_TOKEN_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/projects/:projectId/api-tokens/:tokenId',
  responseType: 'json',
  pathParamSchema: projectIdParamSchema.merge(tokenIdParamSchema),
  responseSchema: successResponseSchema,
  summary: 'Revoke API token',
  description: 'Revoke an API token',
  tags: ['Projects'],
  handler: async params => {
    const { admin, userId } = params;
    const { projectId, tokenId } = params as AdminServerContext & { projectId: string; tokenId: string };
    const project = await admin.getProject(userId, projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const storage = admin.getStorage();
    await storage.deleteProjectApiToken(tokenId);

    return { success: true };
  },
};

/**
 * All project routes.
 */
export const PROJECT_ROUTES: AdminServerRoute[] = [
  LIST_PROJECTS_ROUTE,
  CREATE_PROJECT_ROUTE,
  GET_PROJECT_ROUTE,
  UPDATE_PROJECT_ROUTE,
  DELETE_PROJECT_ROUTE,
  LIST_ENV_VARS_ROUTE,
  SET_ENV_VAR_ROUTE,
  DELETE_ENV_VAR_ROUTE,
  LIST_API_TOKENS_ROUTE,
  CREATE_API_TOKEN_ROUTE,
  REVOKE_API_TOKEN_ROUTE,
];

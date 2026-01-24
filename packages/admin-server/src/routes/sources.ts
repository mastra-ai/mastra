import type { AdminServerContext, AdminServerRoute } from '../types';
import { teamIdParamSchema, sourceIdParamSchema } from '../schemas/common';
import { projectSourceResponseSchema, validateSourceResponseSchema, listSourcesQuerySchema } from '../schemas/sources';

/**
 * GET /teams/:teamId/sources - List available project sources.
 */
export const LIST_SOURCES_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams/:teamId/sources',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  queryParamSchema: listSourcesQuerySchema,
  summary: 'List sources',
  description: 'List available project sources for a team',
  tags: ['Sources'],
  handler: async params => {
    const { admin, userId } = params;
    const { teamId, type, page, limit } = params as AdminServerContext & {
      teamId: string;
      type?: string;
      page?: number;
      limit?: number;
    };

    // Verify team access
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Get sources from the source provider
    const sourceProvider = admin.getSource();
    if (!sourceProvider) {
      return {
        data: [],
        total: 0,
        page: page ?? 1,
        perPage: limit ?? 20,
        hasMore: false,
      };
    }

    // List projects from the source provider
    const allSources = await sourceProvider.listProjects(teamId);

    // Filter by type if specified
    const filteredSources = type ? allSources.filter(s => s.type === type) : allSources;

    // Apply pagination
    const pageNum = page ?? 1;
    const perPage = limit ?? 20;
    const start = (pageNum - 1) * perPage;
    const paginatedSources = filteredSources.slice(start, start + perPage);

    return {
      data: paginatedSources,
      total: filteredSources.length,
      page: pageNum,
      perPage,
      hasMore: start + paginatedSources.length < filteredSources.length,
    };
  },
};

/**
 * GET /sources/:sourceId - Get source details.
 */
export const GET_SOURCE_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/sources/:sourceId',
  responseType: 'json',
  pathParamSchema: sourceIdParamSchema,
  responseSchema: projectSourceResponseSchema,
  summary: 'Get source',
  description: 'Get details of a specific project source',
  tags: ['Sources'],
  handler: async params => {
    const { admin } = params;
    const { sourceId } = params as AdminServerContext & { sourceId: string };

    const sourceProvider = admin.getSource();
    if (!sourceProvider) {
      throw new Error('Source provider not configured');
    }

    const source = await sourceProvider.getProject(sourceId);
    return source;
  },
};

/**
 * POST /sources/:sourceId/validate - Validate source access.
 */
export const VALIDATE_SOURCE_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/sources/:sourceId/validate',
  responseType: 'json',
  pathParamSchema: sourceIdParamSchema,
  responseSchema: validateSourceResponseSchema,
  summary: 'Validate source',
  description: 'Validate that the source is accessible and can be used',
  tags: ['Sources'],
  handler: async params => {
    const { admin } = params;
    const { sourceId } = params as AdminServerContext & { sourceId: string };

    const sourceProvider = admin.getSource();
    if (!sourceProvider) {
      return {
        valid: false,
        error: 'Source provider not configured',
      };
    }

    try {
      const source = await sourceProvider.getProject(sourceId);
      const valid = await sourceProvider.validateAccess(source);
      return {
        valid,
        error: valid ? undefined : 'Source is not accessible',
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * All source routes.
 */
export const SOURCE_ROUTES: AdminServerRoute[] = [LIST_SOURCES_ROUTE, GET_SOURCE_ROUTE, VALIDATE_SOURCE_ROUTE];

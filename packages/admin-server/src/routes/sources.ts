import type { AdminServerContext, AdminServerRoute } from '../types';
import { teamIdParamSchema, sourceIdParamSchema } from '../schemas/common';
import {
  projectSourceResponseSchema,
  validateSourceResponseSchema,
  listSourcesQuerySchema,
} from '../schemas/sources';

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
    // Note: The source provider may provide different sources based on the team's configuration
    // For now, we return an empty list if no source provider is configured
    // The actual implementation depends on the source provider

    // This would typically call something like:
    // const sourceProvider = admin.getSourceProvider();
    // if (sourceProvider) {
    //   return sourceProvider.listSources({ type, page, perPage: limit });
    // }

    return {
      data: [],
      total: 0,
      page: page ?? 1,
      perPage: limit ?? 20,
      hasMore: false,
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
    const { admin, userId } = params;
    const { sourceId } = params as AdminServerContext & { sourceId: string };
    // This would typically call the source provider to get source details
    // For now, throw a not found error
    throw new Error('Source not found');
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
    const { admin, userId } = params;
    const { sourceId } = params as AdminServerContext & { sourceId: string };
    // This would typically call the source provider to validate access
    // For now, return invalid with an error
    return {
      valid: false,
      error: 'Source provider not configured',
    };
  },
};

/**
 * All source routes.
 */
export const SOURCE_ROUTES: AdminServerRoute[] = [
  LIST_SOURCES_ROUTE,
  GET_SOURCE_ROUTE,
  VALIDATE_SOURCE_ROUTE,
];

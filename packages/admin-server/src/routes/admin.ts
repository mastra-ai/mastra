import type { AdminServerContext, AdminServerRoute } from '../types';
import { successResponseSchema } from '../schemas/common';
import {
  licenseInfoResponseSchema,
  updateLicenseBodySchema,
  systemStatsResponseSchema,
  listAllUsersQuerySchema,
  listAllTeamsQuerySchema,
} from '../schemas/admin';

/**
 * GET /admin/users - List all users (platform admin only).
 */
export const LIST_ALL_USERS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/admin/users',
  responseType: 'json',
  queryParamSchema: listAllUsersQuerySchema,
  summary: 'List all users',
  description: 'List all users in the system (platform admin only)',
  tags: ['Admin'],
  handler: async params => {
    const { admin, userId } = params;
    const { page, limit, search } = params as AdminServerContext & {
      page?: number;
      limit?: number;
      search?: string;
    };

    // Check if user is platform admin
    const license = admin.getLicenseInfo();
    // Platform admin check would be done via RBAC
    // For now, just proceed with the query

    // listUsers method doesn't exist on storage - return empty placeholder data
    // This would need to be implemented via a proper user listing method
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
 * GET /admin/teams - List all teams (platform admin only).
 */
export const LIST_ALL_TEAMS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/admin/teams',
  responseType: 'json',
  queryParamSchema: listAllTeamsQuerySchema,
  summary: 'List all teams',
  description: 'List all teams in the system (platform admin only)',
  tags: ['Admin'],
  handler: async params => {
    const { admin, userId } = params;
    const { page, limit, search } = params as AdminServerContext & {
      page?: number;
      limit?: number;
      search?: string;
    };

    // listAllTeams method doesn't exist on storage - return empty placeholder data
    // This would need to be implemented via a proper team listing method
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
 * GET /admin/license - Get license info.
 */
export const GET_LICENSE_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/admin/license',
  responseType: 'json',
  responseSchema: licenseInfoResponseSchema,
  summary: 'Get license info',
  description: 'Get current license information',
  tags: ['Admin'],
  handler: async params => {
    const { admin, userId } = params;
    const licenseInfo = admin.getLicenseInfo();

    return {
      valid: licenseInfo.valid,
      tier: licenseInfo.tier,
      maxTeams: licenseInfo.maxTeams ?? null,
      maxProjects: licenseInfo.maxProjects ?? null,
      maxUsersPerTeam: licenseInfo.maxUsersPerTeam ?? null,
      features: licenseInfo.features ?? [],
      expiresAt: licenseInfo.expiresAt?.toISOString() ?? null,
    };
  },
};

/**
 * POST /admin/license - Update license.
 */
export const UPDATE_LICENSE_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/admin/license',
  responseType: 'json',
  bodySchema: updateLicenseBodySchema,
  responseSchema: licenseInfoResponseSchema,
  summary: 'Update license',
  description: 'Update the license key (platform admin only)',
  tags: ['Admin'],
  handler: async params => {
    const { admin, userId } = params;
    const { licenseKey } = params as AdminServerContext & { licenseKey: string };

    // License updates would require revalidation
    // This would typically restart the license validator
    throw new Error('License update not implemented - requires server restart');
  },
};

/**
 * GET /admin/stats - Get system statistics.
 */
export const GET_SYSTEM_STATS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/admin/stats',
  responseType: 'json',
  responseSchema: systemStatsResponseSchema,
  summary: 'Get system stats',
  description: 'Get system-wide statistics (platform admin only)',
  tags: ['Admin'],
  handler: async params => {
    const { admin, userId } = params;

    // getSystemStats method doesn't exist on storage - return placeholder data
    // This would need to be implemented via proper aggregation queries
    return {
      userCount: 0,
      teamCount: 0,
      projectCount: 0,
      deploymentCount: 0,
      runningDeploymentCount: 0,
      buildCount: 0,
      successfulBuildCount: 0,
      failedBuildCount: 0,
    };
  },
};

/**
 * All admin routes.
 */
export const ADMIN_ROUTES: AdminServerRoute[] = [
  LIST_ALL_USERS_ROUTE,
  LIST_ALL_TEAMS_ROUTE,
  GET_LICENSE_ROUTE,
  UPDATE_LICENSE_ROUTE,
  GET_SYSTEM_STATS_ROUTE,
];

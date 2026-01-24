import type { AdminServerContext, AdminServerRoute } from '../types';
import {
  deploymentIdParamSchema,
  serverIdParamSchema,
} from '../schemas/common';
import {
  runningServerResponseSchema,
  serverHealthResponseSchema,
  serverMetricsResponseSchema,
  serverLogsResponseSchema,
  getServerLogsQuerySchema,
} from '../schemas/servers';

/**
 * Helper to convert running server to response format.
 */
function toRunningServerResponse(server: {
  id: string;
  deploymentId: string;
  buildId: string;
  processId: number | null;
  containerId: string | null;
  host: string;
  port: number;
  healthStatus: string;
  lastHealthCheck: Date | null;
  memoryUsageMb: number | null;
  cpuPercent: number | null;
  startedAt: Date;
  stoppedAt: Date | null;
}) {
  return {
    id: server.id,
    deploymentId: server.deploymentId,
    buildId: server.buildId,
    processId: server.processId,
    containerId: server.containerId,
    host: server.host,
    port: server.port,
    healthStatus: server.healthStatus,
    lastHealthCheck: server.lastHealthCheck?.toISOString() ?? null,
    memoryUsageMb: server.memoryUsageMb,
    cpuPercent: server.cpuPercent,
    startedAt: server.startedAt.toISOString(),
    stoppedAt: server.stoppedAt?.toISOString() ?? null,
  };
}

/**
 * GET /deployments/:deploymentId/server - Get running server info.
 */
export const GET_SERVER_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/deployments/:deploymentId/server',
  responseType: 'json',
  pathParamSchema: deploymentIdParamSchema,
  responseSchema: runningServerResponseSchema,
  summary: 'Get server',
  description: 'Get information about the running server for a deployment',
  tags: ['Servers'],
  handler: async params => {
    const { admin, userId } = params;
    const { deploymentId } = params as AdminServerContext & { deploymentId: string };
    const server = await admin.getRunningServer(userId, deploymentId);
    if (!server) {
      throw new Error('No running server for this deployment');
    }
    return toRunningServerResponse(server);
  },
};

/**
 * GET /servers/:serverId/logs - Get server logs.
 */
export const GET_SERVER_LOGS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/servers/:serverId/logs',
  responseType: 'json', // Can be 'stream' for SSE
  pathParamSchema: serverIdParamSchema,
  queryParamSchema: getServerLogsQuerySchema,
  responseSchema: serverLogsResponseSchema,
  summary: 'Get server logs',
  description: 'Get server logs. Set stream=true for SSE streaming.',
  tags: ['Servers'],
  handler: async params => {
    const { admin, userId } = params;
    const { serverId, tail, since } = params as AdminServerContext & {
      serverId: string;
      tail?: number;
      since?: string;
    };
    const storage = admin.getStorage();
    const server = await storage.getRunningServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    // Verify access through deployment
    const deployment = await admin.getDeployment(userId, server.deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Get logs - this would typically come from the runner
    // For now, return empty logs
    return {
      serverId,
      logs: '',
      hasMore: false,
    };
  },
};

/**
 * GET /servers/:serverId/health - Get server health.
 */
export const GET_SERVER_HEALTH_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/servers/:serverId/health',
  responseType: 'json',
  pathParamSchema: serverIdParamSchema,
  responseSchema: serverHealthResponseSchema,
  summary: 'Get server health',
  description: 'Get health status of a running server',
  tags: ['Servers'],
  handler: async params => {
    const { admin, userId } = params;
    const { serverId } = params as AdminServerContext & { serverId: string };
    const storage = admin.getStorage();
    const server = await storage.getRunningServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    // Verify access through deployment
    const deployment = await admin.getDeployment(userId, server.deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    return {
      serverId,
      status: server.healthStatus,
      lastCheck: (server.lastHealthCheck ?? new Date()).toISOString(),
      details: {
        memoryUsageMb: server.memoryUsageMb,
        cpuPercent: server.cpuPercent,
        uptime: server.stoppedAt
          ? null
          : Math.floor((Date.now() - server.startedAt.getTime()) / 1000),
      },
    };
  },
};

/**
 * GET /servers/:serverId/metrics - Get server metrics.
 */
export const GET_SERVER_METRICS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/servers/:serverId/metrics',
  responseType: 'json',
  pathParamSchema: serverIdParamSchema,
  responseSchema: serverMetricsResponseSchema,
  summary: 'Get server metrics',
  description: 'Get resource metrics for a running server',
  tags: ['Servers'],
  handler: async params => {
    const { admin, userId } = params;
    const { serverId } = params as AdminServerContext & { serverId: string };
    const storage = admin.getStorage();
    const server = await storage.getRunningServer(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    // Verify access through deployment
    const deployment = await admin.getDeployment(userId, server.deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    return {
      serverId,
      timestamp: new Date().toISOString(),
      memoryUsageMb: server.memoryUsageMb,
      cpuPercent: server.cpuPercent,
    };
  },
};

/**
 * All server routes.
 */
export const SERVER_ROUTES: AdminServerRoute[] = [
  GET_SERVER_ROUTE,
  GET_SERVER_LOGS_ROUTE,
  GET_SERVER_HEALTH_ROUTE,
  GET_SERVER_METRICS_ROUTE,
];

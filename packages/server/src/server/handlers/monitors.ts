import { randomUUID } from 'node:crypto';
import { evaluateMonitors } from '@mastra/core/evals/monitors';
import type { Monitor } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  createMonitorBodySchema,
  updateMonitorBodySchema,
  monitorSchema,
  listMonitorsResponseSchema,
  monitorIdPathParams,
  listMonitorEventsQuerySchema,
  listMonitorEventsResponseSchema,
  evaluateMonitorsResponseSchema,
} from '../schemas/monitors';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

async function getMonitorsStore(mastra: any) {
  const store = await mastra.getStorage()?.getStore('monitors');
  if (!store) {
    throw new HTTPException(501, { message: 'Monitors storage is not configured' });
  }
  return store;
}

export const LIST_MONITORS_ROUTE = createRoute({
  method: 'GET',
  path: '/monitors',
  responseType: 'json',
  responseSchema: listMonitorsResponseSchema,
  summary: 'List monitors',
  description: 'Returns all score monitors',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const store = await getMonitorsStore(mastra);
      const monitors = await store.listMonitors();
      return { monitors };
    } catch (error) {
      return handleError(error, 'Error listing monitors');
    }
  },
});

export const GET_MONITOR_ROUTE = createRoute({
  method: 'GET',
  path: '/monitors/:monitorId',
  responseType: 'json',
  pathParamSchema: monitorIdPathParams,
  responseSchema: monitorSchema,
  summary: 'Get monitor by ID',
  description: 'Returns a single score monitor',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra, monitorId }) => {
    try {
      const store = await getMonitorsStore(mastra);
      const monitor = await store.getMonitor(monitorId);
      if (!monitor) {
        throw new HTTPException(404, { message: `Monitor ${monitorId} not found` });
      }
      return monitor;
    } catch (error) {
      return handleError(error, 'Error getting monitor');
    }
  },
});

export const CREATE_MONITOR_ROUTE = createRoute({
  method: 'POST',
  path: '/monitors',
  responseType: 'json',
  bodySchema: createMonitorBodySchema,
  responseSchema: monitorSchema,
  summary: 'Create monitor',
  description: 'Creates a durable score monitor with threshold and alert channels',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra, ...body }: any) => {
    try {
      const store = await getMonitorsStore(mastra);
      const now = Date.now();
      const monitor: Monitor = {
        ...body,
        id: body.id ?? randomUUID(),
        status: body.status ?? 'active',
        createdAt: now,
        updatedAt: now,
      };
      return await store.createMonitor(monitor);
    } catch (error) {
      return handleError(error, 'Error creating monitor');
    }
  },
});

export const UPDATE_MONITOR_ROUTE = createRoute({
  method: 'PATCH',
  path: '/monitors/:monitorId',
  responseType: 'json',
  pathParamSchema: monitorIdPathParams,
  bodySchema: updateMonitorBodySchema,
  responseSchema: monitorSchema,
  summary: 'Update monitor',
  description: 'Partially updates a score monitor',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra, monitorId, ...patch }: any) => {
    try {
      const store = await getMonitorsStore(mastra);
      const existing = await store.getMonitor(monitorId);
      if (!existing) {
        throw new HTTPException(404, { message: `Monitor ${monitorId} not found` });
      }
      return await store.updateMonitor(monitorId, patch);
    } catch (error) {
      return handleError(error, 'Error updating monitor');
    }
  },
});

export const DELETE_MONITOR_ROUTE = createRoute({
  method: 'DELETE',
  path: '/monitors/:monitorId',
  responseType: 'json',
  pathParamSchema: monitorIdPathParams,
  summary: 'Delete monitor',
  description: 'Deletes a score monitor and its event history',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra, monitorId }) => {
    try {
      const store = await getMonitorsStore(mastra);
      await store.deleteMonitor(monitorId);
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error deleting monitor');
    }
  },
});

export const LIST_MONITOR_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/monitors/:monitorId/events',
  responseType: 'json',
  pathParamSchema: monitorIdPathParams,
  queryParamSchema: listMonitorEventsQuerySchema,
  responseSchema: listMonitorEventsResponseSchema,
  summary: 'List monitor events',
  description: 'Returns breach/recovery/delivery-failure history for a monitor, newest first',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra, monitorId, ...params }: any) => {
    try {
      const store = await getMonitorsStore(mastra);
      const events = await store.listMonitorEvents(monitorId, {
        limit: params.limit,
        type: params.type,
      });
      return { events };
    } catch (error) {
      return handleError(error, 'Error listing monitor events');
    }
  },
});

export const EVALUATE_MONITORS_ROUTE = createRoute({
  method: 'POST',
  path: '/monitors/evaluate',
  responseType: 'json',
  responseSchema: evaluateMonitorsResponseSchema,
  summary: 'Evaluate all monitors',
  description:
    'Evaluates every active monitor exactly once. Intended as a cron hook for serverless deployments where the built-in interval loop is unavailable.',
  tags: ['Monitors'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const monitorsStore = await getMonitorsStore(mastra);
      const scoresStore = await mastra.getStorage()?.getStore('scores');
      if (!scoresStore) {
        throw new HTTPException(501, { message: 'Scores storage is not configured' });
      }
      const results = await evaluateMonitors({
        monitorsStore,
        scoresStore,
        logger: mastra.getLogger?.(),
      });
      return {
        results: results.map(({ monitorId, value, count, breached, notified }) => ({
          monitorId,
          value,
          count,
          breached,
          notified,
        })),
      };
    } catch (error) {
      return handleError(error, 'Error evaluating monitors');
    }
  },
});

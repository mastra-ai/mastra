/**
 * Audit handlers for EE audit logging capabilities.
 *
 * These routes enable Studio to:
 * - Query audit events with filtering
 * - View individual audit event details
 */

import { HTTPException } from '../http-exception';
import {
  listAuditEventsQuerySchema,
  listAuditEventsResponseSchema,
  auditEventIdSchema,
  getAuditEventResponseSchema,
} from '../schemas/audit';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// GET /api/audit
// ============================================================================

export const LIST_AUDIT_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/audit',
  responseType: 'json',
  queryParamSchema: listAuditEventsQuerySchema,
  responseSchema: listAuditEventsResponseSchema,
  summary: 'List audit events',
  description: 'Returns audit events with optional filtering by actor, action, resource, outcome, and date range.',
  tags: ['Audit'],
  requiresPermission: 'audit:read',
  handler: async ctx => {
    try {
      const { mastra, ...params } = ctx as any;

      const storage = mastra.getStorage?.();
      if (!storage) {
        throw new HTTPException(503, { message: 'Storage not configured' });
      }

      const auditStore = await storage.getStore('audit');
      if (!auditStore) {
        throw new HTTPException(503, { message: 'Audit storage not configured' });
      }

      const {
        page = 0,
        perPage = 50,
        actorId,
        actorType,
        action,
        actionPrefix,
        resourceType,
        resourceId,
        outcome,
        startDate,
        endDate,
      } = params;

      // Build filter object
      const filter: Record<string, unknown> = {};
      if (actorId) filter.actorId = actorId;
      if (actorType) filter.actorType = actorType;
      if (action) filter.action = action;
      if (actionPrefix) filter.actionPrefix = actionPrefix;
      if (resourceType) filter.resourceType = resourceType;
      if (resourceId) filter.resourceId = resourceId;
      if (outcome) filter.outcome = outcome;
      if (startDate) filter.startDate = startDate;
      if (endDate) filter.endDate = endDate;

      const result = await auditStore.listEvents({
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        pagination: { page, perPage },
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing audit events');
    }
  },
});

// ============================================================================
// GET /api/audit/:eventId
// ============================================================================

export const GET_AUDIT_EVENT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/audit/:eventId',
  responseType: 'json',
  pathParamSchema: auditEventIdSchema,
  responseSchema: getAuditEventResponseSchema,
  summary: 'Get audit event by ID',
  description: 'Returns a single audit event by its ID.',
  tags: ['Audit'],
  requiresPermission: 'audit:read',
  handler: async ctx => {
    try {
      const { mastra, eventId } = ctx as any;

      const storage = mastra.getStorage?.();
      if (!storage) {
        throw new HTTPException(503, { message: 'Storage not configured' });
      }

      const auditStore = await storage.getStore('audit');
      if (!auditStore) {
        throw new HTTPException(503, { message: 'Audit storage not configured' });
      }

      const event = await auditStore.getEventById(eventId);
      return event;
    } catch (error) {
      return handleError(error, 'Error getting audit event');
    }
  },
});

// ============================================================================
// Export all audit routes
// ============================================================================

export const AUDIT_ROUTES = [LIST_AUDIT_EVENTS_ROUTE, GET_AUDIT_EVENT_ROUTE];

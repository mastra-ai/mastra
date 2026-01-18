/**
 * Audit log handlers for EE audit capabilities.
 *
 * These routes enable Studio to:
 * - Query audit events with filtering and pagination
 * - View individual audit events
 * - Export audit logs in JSON or CSV format
 *
 * Access to audit logs requires the 'audit:read' permission.
 */

import type { MastraAuthProvider, EEUser } from '@mastra/core/ee';
import { AuditStorage } from '@mastra/core/storage';

import { z } from 'zod';

import { HTTPException } from '../http-exception';
import {
  auditQuerySchema,
  auditListResponseSchema,
  auditEventSchema,
  auditExportQuerySchema,
  auditExportResponseSchema,
} from '../schemas/audit';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

const auditIdSchema = z.object({
  id: z.string().describe('Audit event ID'),
});

/**
 * Helper to get auth provider from Mastra instance.
 * This function will need to be updated once auth provider is integrated into Mastra config.
 */
function getAuthProvider(mastra: any): MastraAuthProvider<EEUser> | null {
  // TODO: Update once auth is integrated into Mastra config
  return null;
}

/**
 * Helper to get audit storage from Mastra instance.
 * This function will need to be updated once storage is properly accessible.
 */
function getAuditStorage(mastra: any): AuditStorage | null {
  // TODO: Access audit storage from Mastra instance
  // This should become: return mastra.getStorage?.()?.audit ?? null;
  return null;
}

/**
 * Check if the current user has the required permission.
 * TODO: Once Request object is available, implement proper permission checking.
 */
async function checkPermission(authProvider: MastraAuthProvider<EEUser> | null, permission: string): Promise<void> {
  if (!authProvider) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  // TODO: Once Request object is available in handler context:
  // const user = await authProvider.getCurrentUser(request);
  // if (!user) {
  //   throw new HTTPException(401, { message: 'Authentication required' });
  // }
  //
  // if (authProvider.rbac) {
  //   const hasPermission = await authProvider.rbac.hasPermission(user, permission);
  //   if (!hasPermission) {
  //     throw new HTTPException(403, { message: 'Insufficient permissions' });
  //   }
  // }
}

/**
 * Sanitize a CSV field to prevent formula injection.
 * Prefixes values starting with =, +, -, @ with a single quote to neutralize them.
 */
function sanitizeCSVField(value: string): string {
  if (!value) return value;

  const firstChar = value.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
    return `'${value}`;
  }
  return value;
}

/**
 * Convert audit events to CSV format
 */
function convertToCSV(events: any[]): string {
  if (events.length === 0) {
    return 'id,timestamp,actorType,actorId,actorEmail,action,resourceType,resourceId,outcome,duration\n';
  }

  const headers = [
    'id',
    'timestamp',
    'actorType',
    'actorId',
    'actorEmail',
    'action',
    'resourceType',
    'resourceId',
    'outcome',
    'duration',
  ];

  const rows = events.map(event => {
    const row = [
      event.id || '',
      event.timestamp?.toISOString() || '',
      event.actor?.type || '',
      event.actor?.id || '',
      event.actor?.email || '',
      event.action || '',
      event.resource?.type || '',
      event.resource?.id || '',
      event.outcome || '',
      event.duration?.toString() || '',
    ];
    return row
      .map(field => {
        const sanitized = sanitizeCSVField(field);
        return `"${sanitized.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ============================================================================
// GET /api/audit
// ============================================================================

export const GET_AUDIT_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/audit',
  responseType: 'json',
  responseSchema: auditListResponseSchema,
  queryParamSchema: auditQuerySchema,
  summary: 'List audit events',
  description: 'Returns a paginated list of audit events with optional filtering. Requires audit:read permission.',
  tags: ['Audit'],
  handler: async ({ mastra, ...params }) => {
    try {
      const authProvider = getAuthProvider(mastra);
      await checkPermission(authProvider, 'audit:read');

      const auditStorage = getAuditStorage(mastra);
      if (!auditStorage) {
        throw new HTTPException(503, { message: 'Audit storage not configured' });
      }

      // Build filter from query parameters
      const filter = {
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        outcome: params.outcome,
        startDate: params.startDate,
        endDate: params.endDate,
        offset: params.offset ?? 0,
        limit: params.limit ?? 100,
      };

      // Query events and get total count
      const events = await auditStorage.query(filter);
      const total = await auditStorage.count({
        actorId: filter.actorId,
        actorType: filter.actorType,
        action: filter.action,
        resourceType: filter.resourceType,
        resourceId: filter.resourceId,
        outcome: filter.outcome,
        startDate: filter.startDate,
        endDate: filter.endDate,
      });

      return {
        events,
        total,
        offset: filter.offset,
        limit: filter.limit,
      };
    } catch (error) {
      return handleError(error, 'Error fetching audit events');
    }
  },
});

// ============================================================================
// GET /api/audit/:id
// ============================================================================

export const GET_AUDIT_EVENT_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/audit/:id',
  responseType: 'json',
  pathParamSchema: auditIdSchema,
  responseSchema: auditEventSchema.nullable(),
  summary: 'Get audit event by ID',
  description: 'Returns a single audit event by its ID. Requires audit:read permission.',
  tags: ['Audit'],
  handler: async ({ mastra, id }) => {
    try {
      const authProvider = getAuthProvider(mastra);
      await checkPermission(authProvider, 'audit:read');

      const auditStorage = getAuditStorage(mastra);
      if (!auditStorage) {
        throw new HTTPException(503, { message: 'Audit storage not configured' });
      }

      if (!id) {
        throw new HTTPException(400, { message: 'Event ID is required' });
      }

      const event = await auditStorage.getById(id);
      if (!event) {
        throw new HTTPException(404, { message: 'Audit event not found' });
      }

      return event;
    } catch (error) {
      return handleError(error, 'Error fetching audit event');
    }
  },
});

// ============================================================================
// GET /api/audit/export
// ============================================================================

export const GET_AUDIT_EXPORT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/audit/export',
  responseType: 'json',
  responseSchema: auditExportResponseSchema,
  queryParamSchema: auditExportQuerySchema,
  summary: 'Export audit events',
  description: 'Export audit events in JSON or CSV format with optional filtering. Requires audit:read permission.',
  tags: ['Audit'],
  handler: async ({ mastra, ...params }) => {
    try {
      const authProvider = getAuthProvider(mastra);
      await checkPermission(authProvider, 'audit:read');

      const auditStorage = getAuditStorage(mastra);
      if (!auditStorage) {
        throw new HTTPException(503, { message: 'Audit storage not configured' });
      }

      // Build filter from query parameters (no pagination for export)
      const filter = {
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        outcome: params.outcome,
        startDate: params.startDate,
        endDate: params.endDate,
      };

      // Query all matching events (no pagination)
      const events = await auditStorage.query(filter);

      const format = params.format || 'json';

      // Convert to requested format and return as download
      if (format === 'csv') {
        const csv = convertToCSV(events);
        // For CSV, we'll return the data directly with appropriate headers
        // The server adapter will handle setting Content-Disposition
        return {
          data: csv,
          contentType: 'text/csv',
          filename: `audit-export-${new Date().toISOString()}.csv`,
        };
      } else {
        // JSON format - return events array
        return events;
      }
    } catch (error) {
      return handleError(error, 'Error exporting audit events');
    }
  },
});

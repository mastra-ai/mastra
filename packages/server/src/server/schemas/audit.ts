import z from 'zod';
import { createPagePaginationSchema } from './common';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Audit actor schema - who performed the action
 */
export const auditActorSchema = z.object({
  type: z.enum(['user', 'system', 'api-key']),
  id: z.string(),
  email: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Audit resource schema - what was affected
 */
export const auditResourceSchema = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string().optional(),
});

/**
 * Audit event schema - full event record
 */
export const auditEventSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  actor: auditActorSchema,
  action: z.string(),
  resource: auditResourceSchema.optional(),
  outcome: z.enum(['success', 'failure', 'denied']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  duration: z.number().optional(),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Query parameters for listing audit events
 */
export const listAuditEventsQuerySchema = createPagePaginationSchema(50).extend({
  actorId: z.string().optional(),
  actorType: z.enum(['user', 'system', 'api-key']).optional(),
  action: z.union([z.string(), z.array(z.string())]).optional(),
  actionPrefix: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'denied']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

/**
 * Path parameters for getting a single audit event
 */
export const auditEventIdSchema = z.object({
  eventId: z.string().describe('Unique identifier for the audit event'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response schema for listing audit events
 */
export const listAuditEventsResponseSchema = z.object({
  events: z.array(auditEventSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.union([z.number(), z.literal(false)]),
  hasMore: z.boolean(),
});

/**
 * Response schema for a single audit event
 */
export const getAuditEventResponseSchema = auditEventSchema.nullable();

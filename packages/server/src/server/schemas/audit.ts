import { z } from 'zod';

// ============================================================================
// Audit Actor Schemas
// ============================================================================

export const auditActorTypeSchema = z.enum(['user', 'system', 'apikey']);

export const auditActorSchema = z.object({
  type: auditActorTypeSchema,
  id: z.string(),
  email: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

// ============================================================================
// Audit Resource Schema
// ============================================================================

export const auditResourceSchema = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string().optional(),
});

// ============================================================================
// Audit Event Schemas
// ============================================================================

export const auditOutcomeSchema = z.enum(['success', 'failure', 'denied']);

export const auditEventSchema = z.object({
  id: z.string(),
  timestamp: z.coerce.date(),
  actor: auditActorSchema,
  action: z.string(),
  resource: auditResourceSchema.optional(),
  outcome: auditOutcomeSchema,
  metadata: z.record(z.unknown()).optional(),
  duration: z.number().optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

export const auditQuerySchema = z.object({
  actorId: z.string().optional(),
  actorType: auditActorTypeSchema.optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  outcome: auditOutcomeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const auditListResponseSchema = z.object({
  events: z.array(auditEventSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const auditExportFormatSchema = z.enum(['json', 'csv']);

export const auditExportQuerySchema = z.object({
  format: auditExportFormatSchema.default('json'),
  actorId: z.string().optional(),
  actorType: auditActorTypeSchema.optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  outcome: auditOutcomeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const auditExportResponseSchema = z.union([
  // JSON format returns array of events
  z.array(auditEventSchema),
  // CSV format returns object with data, contentType, and filename
  z.object({
    data: z.string(),
    contentType: z.string(),
    filename: z.string(),
    truncated: z.boolean().optional(),
    total: z.number().optional(),
    exported: z.number().optional(),
  }),
]);

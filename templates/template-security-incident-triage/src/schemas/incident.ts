import { z } from 'zod';

import { opaqueId, schemaVersion, tenantIdSchema, utcTimestamp } from './common.js';

export const IncidentKindSchema = z.enum([
  'unauthorized_privilege_change',
  'disallowed_country_login',
  'unknown_device_login',
]);
export const IncidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const IncidentStatusSchema = z.enum([
  'received',
  'investigating',
  'awaiting_approval',
  'approved',
  'rejected',
  'containing',
  'contained',
  'failed',
  'closed',
]);

export const IncidentSchema = z
  .object({
    schemaVersion,
    incidentId: opaqueId,
    tenantId: tenantIdSchema,
    subjectId: opaqueId,
    kind: IncidentKindSchema,
    severity: IncidentSeveritySchema.optional(),
    status: IncidentStatusSchema,
    version: z.number().int().nonnegative(),
    timelineSequence: z.number().int().nonnegative(),
    createdAt: utcTimestamp,
    updatedAt: utcTimestamp,
    closedAt: utcTimestamp.optional(),
  })
  .strict();

export type IncidentKind = z.infer<typeof IncidentKindSchema>;
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;
export type Incident = z.infer<typeof IncidentSchema>;

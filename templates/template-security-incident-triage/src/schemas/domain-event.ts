import { z } from 'zod';

import { boundedJsonObject, opaqueId, schemaVersion, tenantIdSchema, utcTimestamp } from './common.js';

export const DomainEventTypeSchema = z.enum([
  'security.alert.received',
  'security.workflow.updated',
  'security.approval.requested',
  'security.approval.decided',
  'security.containment.completed',
  'security.incident.updated',
  'security.dead-letter',
]);

export const DomainEventSchema = z
  .object({
    type: DomainEventTypeSchema,
    runId: opaqueId,
    data: z
      .object({
        eventId: opaqueId,
        schemaVersion,
        occurredAt: utcTimestamp,
        incidentId: opaqueId,
        tenantId: tenantIdSchema,
        correlationId: opaqueId,
        causationId: opaqueId.optional(),
        payload: boundedJsonObject,
      })
      .strict(),
  })
  .strict();
export type DomainEvent = z.infer<typeof DomainEventSchema>;

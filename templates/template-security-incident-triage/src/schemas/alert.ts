import { z } from 'zod';

import { actorSchema, boundedJsonObject, opaqueId, schemaVersion, targetSchema, utcTimestamp } from './common.js';
import { IncidentKindSchema } from './incident.js';

export const AlertSchema = z
  .object({
    schemaVersion,
    alertId: opaqueId,
    source: z.string().trim().min(1).max(64),
    sourceEventId: opaqueId,
    kind: IncidentKindSchema,
    occurredAt: utcTimestamp,
    tenantId: opaqueId,
    subjectId: opaqueId,
    sessionId: opaqueId.optional(),
    deviceId: opaqueId.optional(),
    ip: z.ipv4().or(z.ipv6()).optional(),
    actor: actorSchema,
    target: targetSchema,
    changes: boundedJsonObject.optional(),
    rawPayloadRef: z.string().trim().min(1).max(512),
    idempotencyKey: opaqueId,
  })
  .strict();

export type Alert = z.infer<typeof AlertSchema>;

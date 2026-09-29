import { z } from 'zod';

import { boundedJsonObject, opaqueId, schemaVersion, shortText, utcTimestamp } from '../schemas/common.js';

export const TimelineWriteSchema = z
  .object({
    timelineId: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    sequence: z.number().int().positive(),
    type: shortText,
    correlationId: opaqueId,
    causationId: opaqueId.optional(),
    occurredAt: utcTimestamp,
    payload: boundedJsonObject,
    schemaVersion,
  })
  .strict();

export const AppendTimelineEventInputSchema = z
  .object({
    incidentId: opaqueId,
    tenantId: opaqueId,
    type: shortText,
    correlationId: opaqueId,
    causationId: opaqueId.optional(),
    payload: boundedJsonObject,
  })
  .strict();

export const TimelineEventSchema = z
  .object({
    id: opaqueId,
    incidentId: opaqueId,
    tenantId: opaqueId,
    sequence: z.number().int().positive(),
    type: shortText,
    occurredAt: utcTimestamp,
    payload: boundedJsonObject,
  })
  .strict();

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

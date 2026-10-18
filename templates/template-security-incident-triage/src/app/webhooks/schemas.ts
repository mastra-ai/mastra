import { z } from 'zod';

import { boundedJsonObject, tenantIdSchema } from '../../schemas/common.js';
import { IncidentKindSchema } from '../../schemas/incident.js';

const webhookId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u);
const webhookTimestamp = z.iso.datetime({ offset: true });
const actor = z
  .object({
    id: webhookId,
    type: z.enum(['user', 'service', 'system', 'unknown']),
    displayName: z.string().trim().min(1).max(128).optional(),
  })
  .strict();
const target = z
  .object({
    id: webhookId,
    type: z.enum(['user', 'session', 'device', 'role', 'resource']),
  })
  .strict();

export const AlertWebhookSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.string().min(1).max(64),
    sourceEventId: webhookId,
    kind: IncidentKindSchema,
    occurredAt: webhookTimestamp,
    tenantId: tenantIdSchema,
    subjectId: webhookId,
    sessionId: webhookId.optional(),
    deviceId: webhookId.optional(),
    ip: z.ipv4().or(z.ipv6()).optional(),
    actor,
    target,
    changes: boundedJsonObject.optional(),
  })
  .strict();

// Serialized WorkOS 8.13 webhook shapes put the entity directly in `data`.
// The entity's `object` is a discriminator string, not a nested record.
export const WorkOsRealEnvelopeSchema = z
  .object({
    object: z.literal('event').optional(),
    id: webhookId,
    event: z.enum(['organization_membership.updated', 'session.created', 'session.revoked']),
    created_at: webhookTimestamp,
    data: z.record(z.string(), z.unknown()),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const WorkOsMembershipObjectSchema = z
  .object({
    object: z.literal('organization_membership'),
    id: webhookId,
    organization_id: webhookId,
    user_id: webhookId,
    role: z.object({ slug: z.string().trim().min(1).max(64) }).strict(),
    status: z.enum(['active', 'inactive', 'pending']),
    created_at: webhookTimestamp,
    updated_at: webhookTimestamp,
  })
  .passthrough();

export const WorkOsSessionObjectSchema = z
  .object({
    object: z.literal('session'),
    id: webhookId,
    user_id: webhookId,
    organization_id: webhookId.optional(),
    // The Events API examples omit status for session lifecycle webhooks.
    // When absent, the signed event discriminator is authoritative.
    status: z.enum(['active', 'revoked', 'expired']).optional(),
    ip_address: z.ipv4().or(z.ipv6()).nullable(),
    created_at: webhookTimestamp,
    updated_at: webhookTimestamp,
  })
  .passthrough();

export type AlertWebhook = z.infer<typeof AlertWebhookSchema>;

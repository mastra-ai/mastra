import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { opaqueId, sha256, utcTimestamp } from '../../schemas/common.js';
import { IncidentKindSchema, IncidentSeveritySchema, IncidentStatusSchema } from '../../schemas/incident.js';

export const IncidentListQuerySchema = z
  .object({
    kind: IncidentKindSchema.optional(),
    status: IncidentStatusSchema.optional(),
    severity: IncidentSeveritySchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/)
      .optional(),
  })
  .strict();

export const DashboardDecisionRequestSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(2_000).optional(),
    planId: opaqueId,
    planHashVersion: z.literal(1),
    planHash: sha256,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'rejected' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A rejection reason is required.',
      });
    }
  });

export const DashboardManualReviewRequestSchema = z
  .object({
    decision: z.enum(['accepted', 'dismissed', 'resolved']),
    reason: z.string().trim().min(1).max(2_000).optional(),
    workflowRunId: opaqueId,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === 'dismissed' || value.decision === 'resolved') && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A closing reason is required.',
      });
    }
  });

export const DashboardDeviceAuthorizationRequestSchema = z
  .object({
    action: z.enum(['authorize', 'revoke']),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const DashboardTimelineEventSchema = z
  .object({
    incidentId: opaqueId,
    workflowRunId: opaqueId.nullable(),
    sequence: z.number().int().positive(),
    type: z.string().min(1).max(256),
    occurredAt: utcTimestamp,
    payloadRedacted: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();

export type DashboardTimelineEvent = z.infer<typeof DashboardTimelineEventSchema>;

export function encodeCursor(
  input: Readonly<{
    updatedAt: string;
    incidentId: string;
    tenantId: string;
    filters: string;
  }>,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function decodeCursor(
  value: string,
  input: Readonly<{ tenantId: string; filters: string }>,
  secret: string,
): Readonly<{ updatedAt: string; incidentId: string }> | null {
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return null;
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const result = z
      .object({
        updatedAt: utcTimestamp,
        incidentId: opaqueId,
        tenantId: opaqueId,
        filters: z.string().max(256),
      })
      .strict()
      .safeParse(parsed);
    return result.success && result.data.tenantId === input.tenantId && result.data.filters === input.filters
      ? { updatedAt: result.data.updatedAt, incidentId: result.data.incidentId }
      : null;
  } catch {
    return null;
  }
}

import { z } from 'zod';

import { tenantIdSchema, timestampSchema } from '../../domain/identifiers.js';

export const webhookEndpointSchema = z.enum(['CUSTOMER_RESPONSE', 'COMPLIANCE_DECISION']);
export const webhookReceiptSchema = z
  .object({
    tenantId: tenantIdSchema,
    endpoint: webhookEndpointSchema,
    deliveryId: z.string().min(1).max(128),
    idempotencyKey: z.string().min(8).max(256),
    payloadFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    keyId: z.string().min(1).max(128),
    signedAt: timestampSchema,
    status: z.enum(['PROCESSING', 'COMPLETED']),
    leaseExpiresAt: timestampSchema,
    outcome: z.json().nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const acquireWebhookReceiptInputSchema = webhookReceiptSchema
  .pick({
    tenantId: true,
    endpoint: true,
    deliveryId: true,
    idempotencyKey: true,
    payloadFingerprint: true,
    keyId: true,
    signedAt: true,
  })
  .extend({ acquiredAt: timestampSchema, leaseExpiresAt: timestampSchema })
  .strict();

export const acquireWebhookReceiptResultSchema = z
  .object({ receipt: webhookReceiptSchema, acquired: z.boolean(), replayed: z.boolean() })
  .strict();

export const completeWebhookReceiptInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    endpoint: webhookEndpointSchema,
    deliveryId: z.string().min(1).max(128),
    payloadFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    outcome: z.json(),
    completedAt: timestampSchema,
  })
  .strict();

export interface WebhookReceiptRepository {
  acquire(
    input: z.infer<typeof acquireWebhookReceiptInputSchema>,
  ): Promise<z.infer<typeof acquireWebhookReceiptResultSchema>>;
  complete(input: z.infer<typeof completeWebhookReceiptInputSchema>): Promise<z.infer<typeof webhookReceiptSchema>>;
}

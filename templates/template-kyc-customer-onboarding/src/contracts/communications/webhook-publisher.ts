import { z } from 'zod';

import { caseIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';

export const publishWebhookInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    eventType: z.string().min(1).max(100),
    safePayload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export const publishWebhookResultSchema = z
  .object({
    deliveryId: z.string().min(1),
    status: z.enum(['CAPTURED', 'DELIVERED']),
    replayed: z.boolean(),
  })
  .strict();

export interface WebhookPublisher {
  readonly id: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  publish(
    input: z.infer<typeof publishWebhookInputSchema>,
    context: ProviderExecutionContext,
  ): Promise<z.infer<typeof publishWebhookResultSchema>>;
}

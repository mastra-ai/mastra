import { z } from 'zod';

import { notificationSchema } from '../../domain/communications.js';
import { idempotencyKeySchema } from '../../domain/identifiers.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';

export const sendNotificationInputSchema = z
  .object({ notification: notificationSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export const notificationDeliveryResultSchema = z
  .object({
    channelId: z.string().min(1),
    status: z.enum(['DELIVERED', 'FAILED']),
    replayed: z.boolean(),
  })
  .strict();

export interface NotificationChannel {
  readonly id: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  deliver(
    input: z.infer<typeof sendNotificationInputSchema>,
    context: ProviderExecutionContext,
  ): Promise<z.infer<typeof notificationDeliveryResultSchema>>;
}

export interface NotificationProvider {
  send(
    input: z.infer<typeof sendNotificationInputSchema>,
    context: ProviderExecutionContext,
  ): Promise<z.infer<typeof notificationDeliveryResultSchema>[]>;
}

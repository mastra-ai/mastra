import { z } from 'zod';

import { applicationSchema } from '../../domain/application.js';
import { applicationIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';

export const putApplicationInputSchema = z
  .object({
    application: applicationSchema,
    idempotencyKey: idempotencyKeySchema,
    requestFingerprint: z.string().min(1).max(128),
  })
  .strict();
export const getApplicationInputSchema = z
  .object({ tenantId: tenantIdSchema, applicationId: applicationIdSchema })
  .strict();

export interface ApplicationRepository {
  put(input: z.infer<typeof putApplicationInputSchema>): Promise<z.infer<typeof applicationSchema>>;
  get(input: z.infer<typeof getApplicationInputSchema>): Promise<z.infer<typeof applicationSchema>>;
}

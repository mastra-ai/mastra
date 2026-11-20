import { z } from 'zod';

import { executionContextSchema } from '../../domain/context.js';
import { idempotencyKeySchema, timestampSchema } from '../../domain/identifiers.js';

export const providerExecutionContextSchema = z
  .object({
    execution: executionContextSchema,
    deadlineAt: timestampSchema,
    attempt: z.number().int().positive(),
    idempotencyKey: idempotencyKeySchema.optional(),
  })
  .strict();

export type ProviderExecutionContext = z.infer<typeof providerExecutionContextSchema>;

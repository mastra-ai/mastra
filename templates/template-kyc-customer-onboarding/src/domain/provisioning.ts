import { z } from 'zod';

import { accountIdSchema, caseIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';

export const accountProvisioningResultSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    accountId: accountIdSchema,
    status: z.enum(['CREATED', 'ACTIVE']),
    providerReference: z.string().min(1).max(128),
    provisionedAt: timestampSchema,
  })
  .strict();

export type AccountProvisioningResult = z.infer<typeof accountProvisioningResultSchema>;

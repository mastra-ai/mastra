import { z } from 'zod';

import type { accountProvisioningResultSchema } from '../../domain/provisioning.js';
import { caseIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';
import type { ProviderExecutionContext } from '../shared/execution-context.js';
import type { providerCapabilitiesSchema } from '../shared/provider.js';

export const accountProvisioningInputSchema = z
  .object({ tenantId: tenantIdSchema, caseId: caseIdSchema, idempotencyKey: idempotencyKeySchema })
  .strict();

export interface AccountProvisioningProvider {
  readonly id: string;
  readonly capabilities: z.infer<typeof providerCapabilitiesSchema>;
  provision(
    input: z.infer<typeof accountProvisioningInputSchema>,
    context: ProviderExecutionContext,
  ): Promise<z.infer<typeof accountProvisioningResultSchema>>;
}

import type { Client } from '@libsql/client';

import {
  accountProvisioningInputSchema,
  type AccountProvisioningProvider,
} from '../../contracts/provisioning/account-provisioning.js';
import { ProviderRejectedInputError, type ProviderCapabilities } from '../../contracts/shared/provider.js';
import type { Clock, IdGenerator } from '../../contracts/technical/primitives.js';
import { accountProvisioningResultSchema } from '../../domain/provisioning.js';
import { fingerprintRequest, runIdempotentMutation } from '../../storage/libsql/idempotent-mutation.js';
import { providerTimestamp } from './provider-time.js';

export class SimulatedAccountProvisioningProvider implements AccountProvisioningProvider {
  readonly id = 'simulated';
  readonly capabilities = Object.freeze({
    operations: ['ACCOUNT_PROVISIONING'],
    environments: ['test', 'demo-default', 'demo-strict'],
    externalNetwork: false,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['NONE'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  } satisfies ProviderCapabilities);
  constructor(
    private readonly client: Client,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async provision(
    input: Parameters<AccountProvisioningProvider['provision']>[0],
    context: Parameters<AccountProvisioningProvider['provision']>[1],
  ) {
    const parsed = accountProvisioningInputSchema.parse(input);
    if (parsed.tenantId !== context.execution.tenantId) {
      throw new ProviderRejectedInputError({
        providerId: this.id,
        operation: 'ACCOUNT_PROVISIONING',
        safeMessage: 'The execution tenant does not match the provisioning tenant',
      });
    }
    const provisionedAt = providerTimestamp(this.clock, context, this.id, 'ACCOUNT_PROVISIONING');
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.tenantId,
      operation: 'ACCOUNT_PROVISIONING',
      key: parsed.idempotencyKey,
      requestFingerprint: fingerprintRequest({
        tenantId: parsed.tenantId,
        caseId: parsed.caseId,
      }),
      createdAt: provisionedAt,
      completedAt: provisionedAt,
      execute: async transaction => {
        const result = accountProvisioningResultSchema.parse({
          tenantId: parsed.tenantId,
          caseId: parsed.caseId,
          accountId: this.ids.generate('account'),
          status: 'ACTIVE',
          providerReference: `simulated-${parsed.caseId}`,
          provisionedAt,
        });
        await transaction.execute({
          sql: `INSERT INTO provisioned_accounts
            (tenant_id,case_id,account_id,idempotency_key,payload_json,created_at)
            VALUES (?,?,?,?,?,?)`,
          args: [
            parsed.tenantId,
            parsed.caseId,
            result.accountId,
            parsed.idempotencyKey,
            JSON.stringify(result),
            result.provisionedAt,
          ],
        });
        return result;
      },
      parseResult: value => accountProvisioningResultSchema.parse(value),
    });
    return mutation.result;
  }
}

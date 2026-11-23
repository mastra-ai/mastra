import type { AccountProvisioningProvider } from '../../contracts/provisioning/account-provisioning.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerAccountProvisioningProvider implements AccountProvisioningProvider {
  readonly id = 'customer-account-provisioning';
  readonly capabilities: ProviderCapabilities = {
    operations: ['ACCOUNT_PROVISIONING'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['NONE'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  provision(
    input: Parameters<AccountProvisioningProvider['provision']>[0],
    context: Parameters<AccountProvisioningProvider['provision']>[1],
  ): ReturnType<AccountProvisioningProvider['provision']> {
    void input;
    void context;
    // TODO: Call the customer account/core-system create or activation operation.
    // TODO: Return AccountProvisioningResult with the stable downstream reference.
    // TODO: Map timeout, rejection, invalid response, and availability errors to ProviderError.
    // TODO: Send only approved-case identifiers, honor the deadline, and reuse the provisioning idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'ACCOUNT_PROVISIONING',
        safeMessage: 'Customer account provisioning is not implemented',
      }),
    );
  }
}

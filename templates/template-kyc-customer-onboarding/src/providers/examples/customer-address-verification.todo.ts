import type { AddressVerificationProvider } from '../../contracts/providers/verification.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerAddressVerificationProvider implements AddressVerificationProvider {
  readonly id = 'customer-address-verification';
  readonly version = 'todo';
  readonly capabilities: ProviderCapabilities = {
    operations: ['ADDRESS_VERIFICATION'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['ADDRESS'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  verify(
    input: Parameters<AddressVerificationProvider['verify']>[0],
    context: Parameters<AddressVerificationProvider['verify']>[1],
  ): ReturnType<AddressVerificationProvider['verify']> {
    void input;
    void context;
    // TODO: Call the customer address-verification operation with normalized address evidence.
    // TODO: Return VerificationResult without claiming authoritative residency.
    // TODO: Map proprietary rejection, timeout, rate-limit, invalid-result, and availability errors.
    // TODO: Minimize address PII, honor the deadline, and preserve the request idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'ADDRESS_VERIFICATION',
        safeMessage: 'Customer address verification is not implemented',
      }),
    );
  }
}

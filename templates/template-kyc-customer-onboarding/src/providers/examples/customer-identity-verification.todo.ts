import type { IdentityVerificationProvider } from '../../contracts/providers/verification.js';
import { ProviderNotImplementedError, type ProviderCapabilities } from '../../contracts/shared/provider.js';

export class CustomerIdentityVerificationProvider implements IdentityVerificationProvider {
  readonly id = 'customer-identity-verification';
  readonly version = 'todo';
  readonly capabilities: ProviderCapabilities = {
    operations: ['IDENTITY_VERIFICATION'],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['IDENTITY'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  verify(
    input: Parameters<IdentityVerificationProvider['verify']>[0],
    context: Parameters<IdentityVerificationProvider['verify']>[1],
  ): ReturnType<IdentityVerificationProvider['verify']> {
    void input;
    void context;
    // TODO: Call the customer identity-verification operation using the normalized request.
    // TODO: Return VerificationResult with status, reason codes, evidence, and provider metadata.
    // TODO: Map proprietary rejection, timeout, rate-limit, invalid-result, and availability errors.
    // TODO: Minimize identity PII, honor the deadline, and preserve the request idempotency key.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: this.id,
        operation: 'IDENTITY_VERIFICATION',
        safeMessage: 'Customer identity verification is not implemented',
      }),
    );
  }
}

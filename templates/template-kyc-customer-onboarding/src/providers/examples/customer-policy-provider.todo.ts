import type { JurisdictionPolicyProvider } from '../../contracts/policies/policies.js';
import { ProviderNotImplementedError } from '../../contracts/shared/provider.js';

export class CustomerJurisdictionPolicyProvider implements JurisdictionPolicyProvider {
  resolve(
    input: Parameters<JurisdictionPolicyProvider['resolve']>[0],
  ): ReturnType<JurisdictionPolicyProvider['resolve']> {
    void input;
    // TODO: Load the customer-approved jurisdiction policy from its controlled policy repository.
    // TODO: Return a schema-valid immutable policy with semantic version and content checksum.
    // TODO: Map missing, invalid, stale, and unavailable policy failures to safe typed errors.
    // TODO: Keep policies free of customer PII and require explicit audited migration for suspended cases.
    return Promise.reject(
      new ProviderNotImplementedError({
        providerId: 'customer-policy-provider',
        operation: 'POLICY_RESOLUTION',
        safeMessage: 'Customer policy provider is not implemented',
      }),
    );
  }
}

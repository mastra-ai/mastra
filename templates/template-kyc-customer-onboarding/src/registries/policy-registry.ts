import type { JurisdictionPolicyProvider, RiskPolicyProvider } from '../contracts/policies/policies.js';
import { RegistryConfigurationError } from './provider-registry.js';

export class JurisdictionPolicyRegistry {
  readonly #providers = new Map<string, JurisdictionPolicyProvider>();

  register(id: string, provider: JurisdictionPolicyProvider): this {
    if (this.#providers.has(id)) {
      throw new RegistryConfigurationError('DUPLICATE_PROVIDER', `Policy ${id} is registered more than once`);
    }
    this.#providers.set(id, provider);
    return this;
  }

  resolve(id: string): JurisdictionPolicyProvider {
    const provider = this.#providers.get(id);
    if (provider === undefined) {
      throw new RegistryConfigurationError('UNKNOWN_PROVIDER', `Unknown policy: ${id}`);
    }
    return provider;
  }
}

export class RiskPolicyRegistry {
  readonly #providers = new Map<string, RiskPolicyProvider>();

  register(id: string, provider: RiskPolicyProvider): this {
    if (this.#providers.has(id)) {
      throw new RegistryConfigurationError('DUPLICATE_PROVIDER', `Risk policy ${id} is registered more than once`);
    }
    this.#providers.set(id, provider);
    return this;
  }

  resolve(id: string): RiskPolicyProvider {
    const provider = this.#providers.get(id);
    if (provider === undefined) {
      throw new RegistryConfigurationError('UNKNOWN_PROVIDER', `Unknown risk policy: ${id}`);
    }
    return provider;
  }
}

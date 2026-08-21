import type { SanctionsScreener } from '../ports.ts';
import { fixtureProvider } from './fixture-provider.ts';
import { makeQuickBooksProvider } from './quickbooks-provider.ts';
import { makeQuickBooksMcpProvider } from './quickbooks-mcp-provider.ts';
import {
  assertCapabilityPolicy,
  assertProvider,
  defaultCapabilityPolicy,
  type AccountingProvider,
  type BooleanCapability,
  type CapabilityPolicy,
} from './types.ts';

export type ProviderFactory = () => AccountingProvider;
export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();
  register(id: string, factory: ProviderFactory) {
    if (this.factories.has(id)) throw new Error(`Provider ${id} already registered`);
    this.factories.set(id, factory);
    return this;
  }
  create(id: string) {
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`Unknown accounting provider: ${id}`);
    return assertProvider(factory());
  }
  ids() {
    return [...this.factories.keys()];
  }
}
export const providerRegistry = new ProviderRegistry()
  .register('fixture', () => fixtureProvider)
  .register('quickbooks', () => makeQuickBooksProvider())
  .register('quickbooks-mcp', () => makeQuickBooksMcpProvider());

export function validateProviderSelection(
  provider: AccountingProvider,
  options: { policy?: CapabilityPolicy; sanctionsFallback?: SanctionsScreener } = {},
) {
  const policy = options.policy ?? defaultCapabilityPolicy;
  assertCapabilityPolicy(policy);
  const missing = policy.required.filter(
    capability => !provider.capabilities[capability] && !(capability === 'sanctions' && options.sanctionsFallback),
  );
  if (missing.length)
    throw new Error(`Accounting provider ${provider.id} is missing required capabilities: ${missing.join(', ')}`);
  return provider;
}
export const missingCapabilities = (provider: AccountingProvider, capabilities: BooleanCapability[]) =>
  capabilities.filter(capability => !provider.capabilities[capability]);

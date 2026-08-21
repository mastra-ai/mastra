import {
  FixturePolicyProvider,
  FixtureSanctionsScreener,
  InMemoryInvoiceHistoryRepository,
} from './adapters/fixture.ts';
import type {
  InvoiceHistoryRepository,
  PolicyProvider,
  SanctionsScreener,
  VendorStatusRestrictionSource,
} from './ports.ts';
import { providerRegistry, validateProviderSelection } from './providers/registry.ts';
import { sourceId, type AccountingProvider } from './providers/types.ts';

export interface Phase2Runtime {
  provider: AccountingProvider;
  history: InvoiceHistoryRepository;
  policy: PolicyProvider;
  sanctions: SanctionsScreener;
  sanctionsIsFallback: boolean;
  statusRestrictions?: VendorStatusRestrictionSource;
  seedHistory(): Promise<void>;
}
export function createPhase2Runtime(
  options: {
    provider?: AccountingProvider;
    providerId?: string;
    history?: InvoiceHistoryRepository;
    policy?: PolicyProvider;
    sanctionsFallback?: SanctionsScreener;
    statusRestrictions?: VendorStatusRestrictionSource;
  } = {},
): Phase2Runtime {
  const provider =
    options.provider ?? providerRegistry.create(options.providerId ?? process.env.ACCOUNTING_PROVIDER ?? 'fixture');
  const fallback =
    options.sanctionsFallback ??
    (process.env.SANCTIONS_SCREENING === 'fixture' ? new FixtureSanctionsScreener() : undefined);
  validateProviderSelection(provider, { sanctionsFallback: fallback });
  const sanctions = provider.sanctions ?? fallback;
  if (!sanctions) throw new Error(`Accounting provider ${provider.id} requires a sanctions screener`);
  const history = options.history ?? new InMemoryInvoiceHistoryRepository(),
    policy = options.policy ?? new FixturePolicyProvider();
  let syncing: Promise<void> | undefined;
  return {
    provider,
    history,
    policy,
    sanctions,
    sanctionsIsFallback: !provider.sanctions,
    statusRestrictions: options.statusRestrictions,
    seedHistory: () => {
      if (!provider.billHistorySeed) return Promise.resolve();
      if (!syncing)
        syncing = provider
          .billHistorySeed()
          .then(invoices => history.seed(invoices))
          .catch(error => {
            syncing = undefined;
            throw error;
          });
      return syncing;
    },
  };
}
export const activePhase2Runtime = createPhase2Runtime();
export const runtimeSources = (runtime: Phase2Runtime) => ({
  vendors: sourceId(runtime.provider, 'vendors'),
  purchaseOrders: sourceId(runtime.provider, 'purchaseOrders'),
  goodsReceipts: sourceId(runtime.provider, 'goodsReceipts'),
  sanctions: runtime.sanctionsIsFallback ? 'standalone-sanctions' : sourceId(runtime.provider, 'sanctions'),
  billHistory: runtime.provider.billHistorySeed ? sourceId(runtime.provider, 'billHistory') : 'pipeline-history',
});

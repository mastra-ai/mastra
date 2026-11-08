import { BillingDatabase } from './storage/database.js';
import { retainCatalog } from './storage/catalog.js';
import { z } from 'zod';
import { BillingError } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { parseBillingConfiguration } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { LocalBillingProvider, localCapabilities } from './providers/local.js';
import { LocalBillingStorage } from './storage/libsql.js';
import { PolarBillingProvider, polarCapabilities } from './providers/polar.js';
import type { BillingContactResolver } from './providers/polar-contract.js';

const strategies = {
  local: {
    capabilities: localCapabilities,
    create: (storage: LocalBillingStorage, configuration: BillingConfiguration): BillingProvider =>
      new LocalBillingProvider(storage, configuration),
  },
};

export interface PolarProviderOptions {
  token: string;
  contact: BillingContactResolver;
  webhookSecret?: string;
}

export async function initializeBilling(options: {
  configuration: unknown;
  storage: { url: string };
  polar?: PolarProviderOptions;
}): Promise<{
  readonly configuration: BillingConfiguration;
  readonly provider: BillingProvider;
  readonly close: () => void;
}> {
  const selection = z.object({ provider: z.enum(['local', 'polar']) }).safeParse(options.configuration);
  if (!selection.success) throw new BillingError('invalid_configuration');
  if (selection.data.provider === 'polar') {
    const polar = z.object({ polar: z.unknown() }).safeParse(options.configuration);
    if (!options.polar || !polar.success || !polar.data.polar) throw new BillingError('unsupported');
    const configuration = parseBillingConfiguration(options.configuration, polarCapabilities);
    const provider = await PolarBillingProvider.open({
      url: options.storage.url,
      configuration: configuration.polar,
      catalog: configuration.catalog,
      ...options.polar,
    });
    return Object.freeze({ configuration, provider, close: () => provider.close() });
  }
  const strategy = strategies[selection.data.provider as keyof typeof strategies];
  if (!strategy) throw new BillingError('unsupported');
  const configuration = parseBillingConfiguration(options.configuration, strategy.capabilities);
  const catalogDatabase = await BillingDatabase.open(options.storage);
  try {
    await retainCatalog(catalogDatabase, configuration.catalog);
  } finally {
    catalogDatabase.close();
  }
  const storage = await LocalBillingStorage.open(options.storage);
  return Object.freeze({
    configuration,
    provider: strategy.create(storage, configuration),
    close: () => storage.close(),
  });
}

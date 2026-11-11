import { z } from 'zod';
import { BillingError, identifierSchema } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { parseBillingConfiguration } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { AutumnBillingProvider } from './providers/autumn.js';
import type { AutumnProviderOptions } from './providers/autumn.js';
import { LocalBillingProvider, localCapabilities } from './providers/local.js';
import { BillingDatabase } from './storage/database.js';
import { retainCatalog } from './storage/catalog.js';
import { LocalBillingStorage } from './storage/libsql.js';

export async function initializeBilling(options: {
  configuration: unknown;
  storage: { url: string };
  autumn?: AutumnProviderOptions;
}): Promise<{
  readonly configuration: BillingConfiguration;
  readonly provider: BillingProvider;
  readonly close: () => void;
}> {
  const selection = z.object({ provider: identifierSchema }).safeParse(options.configuration);
  if (!selection.success) throw new BillingError('invalid_configuration');
  if (selection.data.provider === 'autumn') {
    if (!options.autumn) throw new BillingError('invalid_configuration');
    const provider = await AutumnBillingProvider.open(options.storage, options.autumn);
    try {
      const configuration = parseBillingConfiguration(options.configuration, provider.capabilities);
      for (const meter of configuration.mappings.meters) provider.bindUsage(meter.key);
      return Object.freeze({ configuration, provider, close: () => provider.close() });
    } catch (error) {
      provider.close();
      throw error;
    }
  }
  if (selection.data.provider !== 'local') throw new BillingError('unsupported');
  if (options.autumn) throw new BillingError('invalid_configuration');
  const configuration = parseBillingConfiguration(options.configuration, localCapabilities);
  const catalogDatabase = await BillingDatabase.open(options.storage);
  try {
    await retainCatalog(catalogDatabase, configuration.catalog);
  } finally {
    catalogDatabase.close();
  }
  const storage = await LocalBillingStorage.open(options.storage);
  return Object.freeze({
    configuration,
    provider: new LocalBillingProvider(storage, configuration),
    close: () => storage.close(),
  });
}

import { z } from 'zod';
import { BillingError, identifierSchema } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { parseBillingConfiguration } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { AutumnBillingProvider, autumnCapabilities } from './providers/autumn.js';
import type { AutumnProviderOptions } from './providers/autumn.js';
import { LocalBillingProvider, localCapabilities } from './providers/local.js';
import { BillingDatabase } from './storage/database.js';
import { retainCatalog } from './storage/catalog.js';
import { LocalBillingStorage } from './storage/libsql.js';

interface ProviderOptions {
  configuration: BillingConfiguration;
  storage: { url: string };
  autumn?: AutumnProviderOptions;
}
interface InitializedProvider {
  readonly provider: BillingProvider;
  readonly close: () => void;
}
const providerFactories = {
  local: {
    capabilities: localCapabilities,
    async open(options: ProviderOptions): Promise<InitializedProvider> {
      if (options.autumn) throw new BillingError('invalid_configuration');
      const database = await BillingDatabase.open(options.storage);
      try {
        await retainCatalog(database, options.configuration.catalog);
      } finally {
        database.close();
      }
      const storage = await LocalBillingStorage.open(options.storage);
      return { provider: new LocalBillingProvider(storage, options.configuration), close: () => storage.close() };
    },
  },
  autumn: {
    capabilities: autumnCapabilities,
    async open(options: ProviderOptions): Promise<InitializedProvider> {
      if (!options.autumn) throw new BillingError('invalid_configuration');
      const provider = await AutumnBillingProvider.open(options.storage, options.autumn);
      try {
        for (const meter of options.configuration.mappings.meters) provider.bindUsage(meter.key);
        return { provider, close: () => provider.close() };
      } catch (error) {
        provider.close();
        throw error;
      }
    },
  },
} satisfies Record<
  string,
  { capabilities: BillingProvider['capabilities']; open(options: ProviderOptions): Promise<InitializedProvider> }
>;

export function validateProviderConfiguration(input: unknown) {
  const shape = z.object({ provider: identifierSchema }).safeParse(input);
  if (!shape.success) throw new BillingError('invalid_configuration');
  const selection = z.object({ provider: z.enum(['local', 'autumn']) }).safeParse(shape.data);
  if (!selection.success) throw new BillingError('unsupported');
  return parseBillingConfiguration(input, providerFactories[selection.data.provider].capabilities);
}
export async function initializeBilling(options: {
  configuration: unknown;
  storage: { url: string };
  autumn?: AutumnProviderOptions;
}) {
  const configuration = validateProviderConfiguration(options.configuration);
  const selection = z.enum(['local', 'autumn']).parse(configuration.provider);
  const initialized = await providerFactories[selection].open({ ...options, configuration });
  return Object.freeze({ configuration, ...initialized });
}

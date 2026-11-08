import { BillingDatabase } from './storage/database.js';
import { retainCatalog } from './storage/catalog.js';
import { z } from 'zod';
import { BillingError } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { billingConfigurationSchema, parseBillingConfiguration } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { LocalBillingProvider, localCapabilities } from './providers/local.js';
import { LocalBillingStorage } from './storage/libsql.js';
import { PolarBillingDriver } from './providers/polar.js';
import { BillingService } from './service.js';
import type { BillingDriver } from './driver.js';
import { identifierSchema, usageBindingSchema } from './contracts.js';
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
  drivers?: readonly BillingDriver[];
}): Promise<{
  readonly configuration: BillingConfiguration;
  readonly provider: BillingProvider;
  readonly close: () => void;
}> {
  const selection = z.object({ provider: identifierSchema }).safeParse(options.configuration);
  if (!selection.success) throw new BillingError('invalid_configuration');
  const drivers = [...(options.drivers ?? [])];
  // Built-in convenience factory lives solely at the composition boundary.
  if (options.polar) {
    const normalized = billingConfigurationSchema.safeParse(options.configuration);
    if (!normalized.success || !normalized.data.polar) throw new BillingError('invalid_configuration');
    drivers.push(
      new PolarBillingDriver(
        normalized.data.polar,
        normalized.data.catalog,
        options.polar.token,
        options.polar.contact,
        options.polar.webhookSecret,
      ),
    );
  }
  if (
    drivers.some(driver => driver.id === 'local') ||
    new Set(drivers.map(driver => driver.id)).size !== drivers.length
  )
    throw new BillingError('invalid_configuration');
  if (selection.data.provider !== 'local') {
    const driver = drivers.find(value => value.id === selection.data.provider);
    if (!driver) throw new BillingError(selection.data.provider === 'polar' ? 'unsupported' : 'invalid_configuration');
    const configuration = parseBillingConfiguration(options.configuration, driver.capabilities);
    if ((driver.capabilities.checkout || driver.capabilities.portal) && !configuration.hosted.returnUrls.length)
      throw new BillingError('invalid_configuration');
    for (const meter of configuration.mappings.meters) {
      const binding = usageBindingSchema.safeParse(driver.bindUsage(meter.key));
      if (!binding.success || binding.data.provider !== driver.id || binding.data.meter !== meter.key)
        throw new BillingError('invalid_configuration');
    }
    const provider = await BillingService.connect({
      url: options.storage.url,
      catalog: configuration.catalog,
      activeProvider: driver.id,
      drivers,
    });
    return Object.freeze({ configuration, provider, close: () => provider.close() });
  }
  if (drivers.length) throw new BillingError('invalid_configuration');
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

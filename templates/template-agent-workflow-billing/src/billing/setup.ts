import { z } from 'zod';
import { BillingError } from './contracts.js';
import type { BillingProvider } from './contracts.js';
import { parseBillingConfiguration } from './configuration.js';
import type { BillingConfiguration } from './configuration.js';
import { LocalBillingProvider, localCapabilities } from './providers/local.js';
import { LocalBillingStorage } from './storage/libsql.js';

const strategies = {
  local: {
    capabilities: localCapabilities,
    create: (storage: LocalBillingStorage, configuration: BillingConfiguration): BillingProvider =>
      new LocalBillingProvider(storage, configuration),
  },
};

export async function initializeBilling(options: { configuration: unknown; storage: { url: string } }): Promise<{
  readonly configuration: BillingConfiguration;
  readonly provider: BillingProvider;
  readonly close: () => void;
}> {
  const selection = z.object({ provider: z.enum(['local', 'polar']) }).safeParse(options.configuration);
  if (!selection.success) throw new BillingError('invalid_configuration');
  const strategy = strategies[selection.data.provider as keyof typeof strategies];
  if (!strategy) throw new BillingError('unsupported');
  const configuration = parseBillingConfiguration(options.configuration, strategy.capabilities);
  const storage = await LocalBillingStorage.open(options.storage);
  return Object.freeze({
    configuration,
    provider: strategy.create(storage, configuration),
    close: () => storage.close(),
  });
}

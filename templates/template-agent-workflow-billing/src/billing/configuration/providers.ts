import { z } from 'zod';
import { BillingError, identifierSchema } from '../contracts/core.js';
import type { BillingProvider } from '../contracts/provider.js';
import { parseBillingConfiguration } from './policy.js';
import { openAutumnProvider, autumnCapabilities } from '../providers/autumn/index.js';
import { openLocalProvider, localCapabilities } from '../providers/local/index.js';

const drivers = {
  local: { capabilities: localCapabilities, open: openLocalProvider },
  autumn: { capabilities: autumnCapabilities, open: openAutumnProvider },
};

/** Validate policies and capabilities before storage or external work starts. */
export function validateProviderConfiguration(input: unknown, billingProvider?: BillingProvider) {
  const shape = z.object({ provider: identifierSchema }).safeParse(input);
  if (!shape.success) throw new BillingError('invalid_configuration');
  if (billingProvider) {
    if (billingProvider.id !== shape.data.provider) throw new BillingError('invalid_configuration');
    return parseBillingConfiguration(input, billingProvider.capabilities);
  }
  const selection = z.enum(['local', 'autumn']).safeParse(shape.data.provider);
  if (!selection.success) throw new BillingError('unsupported');
  return parseBillingConfiguration(input, drivers[selection.data].capabilities);
}

/** Resolve a driver from the environment, or use an explicitly supplied implementation. */
export async function initializeBilling(options: {
  /** Validated resource policies, commercial plans and logical billing keys. */
  configuration: unknown;
  /** Private local persistence for execution and provider bookkeeping. */
  storage: { url: string };
  /** Driver-specific secrets and bindings; defaults to process.env. */
  environment?: NodeJS.ProcessEnv;
  /** Optional driver implementation; the runtime owns its cleanup after initialization. */
  billingProvider?: BillingProvider;
}) {
  const configuration = validateProviderConfiguration(options.configuration, options.billingProvider);
  const environment = options.environment ?? process.env;
  if (environment.BILLING_PROVIDER && environment.BILLING_PROVIDER !== configuration.provider)
    throw new BillingError('invalid_configuration');
  const provider =
    options.billingProvider ??
    (await drivers[z.enum(['local', 'autumn']).parse(configuration.provider)].open({
      storage: options.storage,
      configuration,
      environment,
    }));
  return Object.freeze({ configuration, provider, close: () => provider.close?.() });
}

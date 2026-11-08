import { BillingError } from '../contracts.js';
import type { ProviderCapabilities } from '../contracts.js';
import { z } from 'zod';
import { canonicalConfigurationSchema, freezeConfiguration, validateConfiguration } from '../configuration-schema.js';
import { referenceKey } from '../catalog.js';
import { normalizeLegacyCatalog } from './polar-catalog.js';
import { polarBindingsSchema, polarConfigurationSchema, polarCatalogConfigurationSchema } from './polar-contract.js';

// Public compatibility boundary for shipped full Polar configuration inputs.
const compatible = canonicalConfigurationSchema
  .safeExtend({ polar: polarBindingsSchema.optional() })
  .superRefine((config, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (config.provider !== 'polar' && config.polar) issue('Polar configuration requires Polar mode.');
    if (config.provider === 'polar' && config.polar) {
      for (const key of config.mappings.entitlements)
        if (!config.polar.entitlements.some(value => value.key === key)) issue('Missing Polar entitlement mapping.');
      for (const key of config.mappings.subscriptions)
        if (!config.polar.subscriptions.some(value => value.key === key)) issue('Missing Polar subscription mapping.');
      for (const meter of config.mappings.meters) {
        if (!config.polar.meters.some(value => value.key === meter.key)) issue('Missing Polar meter mapping.');
        if (
          meter.funding.includes('prepaid') &&
          !config.polar.grants.some(value =>
            config.catalog.allowances.some(
              allowance => referenceKey(allowance) === referenceKey(value.allowance) && allowance.meter === meter.key,
            ),
          )
        )
          issue('Missing Polar grant mapping.');
        if (
          meter.funding.length !== 1 ||
          config.polar.meters.find(value => value.key === meter.key)?.funding !== meter.funding[0]
        )
          issue('Polar meter funding does not match.');
      }
    }

    if (
      config.polar &&
      !polarCatalogConfigurationSchema.safeParse({ polar: config.polar, catalog: config.catalog }).success
    )
      issue('Invalid catalog provider bindings.');
  });
export const compatibleConfigurationSchema = z.preprocess(input => {
  if (input === null || typeof input !== 'object' || !('polar' in input) || !input.polar) return input;
  const legacy = polarConfigurationSchema.safeParse(input.polar);
  const normalized =
    legacy.success && !('catalog' in input) ? { ...input, ...normalizeLegacyCatalog(legacy.data) } : input;
  const bindings = polarBindingsSchema.safeParse(normalized.polar);
  return bindings.success ? { ...normalized, hosted: { returnUrls: bindings.data.returnUrls } } : normalized;
}, compatible);

export function parseCompatibleConfiguration(input: unknown, capabilities: ProviderCapabilities) {
  const result = compatibleConfigurationSchema.safeParse(input);
  if (!result.success) throw new BillingError('invalid_configuration');
  const { polar, ...canonical } = result.data;
  validateConfiguration(canonical, capabilities);
  return freezeConfiguration(result.data);
}

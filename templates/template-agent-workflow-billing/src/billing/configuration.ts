import { z } from 'zod';
import {
  BillingError,
  identifierSchema,
  positiveQuantitySchema,
  quantitySchema,
  timestampSchema,
} from './contracts.js';
import { commercialCatalogSchema, referenceKey } from './catalog.js';
import { normalizeLegacyCatalog } from './providers/polar-catalog.js';
import {
  polarBindingsSchema,
  polarConfigurationSchema,
  polarCatalogConfigurationSchema,
} from './providers/polar-contract.js';
import type { ProviderCapabilities } from './contracts.js';

const fundingSchema = z.enum(['prepaid', 'metered']);
const unitSchema = z.enum(['credits', 'tasks', 'tokens', 'milliseconds', 'custom']);
const chargeSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('none') }),
  z.strictObject({ type: z.literal('credits'), meter: identifierSchema, units: positiveQuantitySchema }),
  z.strictObject({
    type: z.literal('per-task'),
    meter: identifierSchema,
    units: positiveQuantitySchema,
    funding: fundingSchema,
  }),
  z.strictObject({
    type: z.literal('usage'),
    meter: identifierSchema,
    measure: identifierSchema,
    maxUnits: positiveQuantitySchema,
    funding: fundingSchema,
  }),
]);
export const billingPolicySchema = z.strictObject({
  version: identifierSchema,
  access: z
    .strictObject({ entitlement: identifierSchema.optional(), subscription: identifierSchema.optional() })
    .refine(access => access.entitlement !== undefined || access.subscription !== undefined)
    .optional(),
  charge: chargeSchema,
  suspendedReservationTtlMs: positiveQuantitySchema.optional(),
});

const grantSchema = z
  .strictObject({
    key: identifierSchema,
    validFrom: timestampSchema,
    validUntil: timestampSchema.nullable(),
  })
  .refine(grant => grant.validUntil === null || Date.parse(grant.validUntil) > Date.parse(grant.validFrom));

const initialMeterSchema = z
  .strictObject({
    key: identifierSchema,
    funding: fundingSchema,
    balance: quantitySchema.nullable(),
    periodStart: timestampSchema.nullable().default(null),
    periodEnd: timestampSchema.nullable().default(null),
  })
  .superRefine((meter, ctx) => {
    if ((meter.funding === 'prepaid') !== (meter.balance !== null))
      ctx.addIssue({ code: 'custom', message: 'Prepaid meters require a balance; metered meters require null.' });
    if (
      (meter.periodStart === null) !== (meter.periodEnd === null) ||
      (meter.periodStart !== null &&
        meter.periodEnd !== null &&
        Date.parse(meter.periodStart) >= Date.parse(meter.periodEnd))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid meter period.' });
  });
export const localAccountSeedSchema = z
  .strictObject({
    workspaceId: identifierSchema,
    entitlements: z.array(grantSchema).max(100).default([]),
    subscriptions: z.array(grantSchema).max(100).default([]),
    meters: z.array(initialMeterSchema).max(100).default([]),
  })
  .superRefine((seed, ctx) => {
    for (const entries of [seed.entitlements, seed.subscriptions, seed.meters]) {
      if (new Set(entries.map(entry => entry.key)).size !== entries.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate commercial key.' });
    }
  });
export type LocalAccountSeed = z.infer<typeof localAccountSeedSchema>;

const canonicalConfigurationSchema = z
  .strictObject({
    provider: identifierSchema,
    polar: polarBindingsSchema.optional(),
    catalog: commercialCatalogSchema.default({ allowances: [], offers: [] }),
    resources: z
      .array(
        z.strictObject({
          id: identifierSchema,
          kind: z.enum(['agent', 'workflow']),
          operations: z
            .array(z.enum(['generate', 'start', 'resume', 'cancel']))
            .min(1)
            .max(3),
          measurements: z
            .array(
              z.strictObject({
                key: identifierSchema,
                unit: z.enum(['tokens', 'milliseconds', 'custom']),
                enforceableBound: z.boolean(),
              }),
            )
            .max(100)
            .default([]),
          policy: billingPolicySchema,
        }),
      )
      .max(100),
    mappings: z.strictObject({
      entitlements: z.array(identifierSchema).max(100).default([]),
      subscriptions: z.array(identifierSchema).max(100).default([]),
      meters: z
        .array(
          z.strictObject({ key: identifierSchema, unit: unitSchema, funding: z.array(fundingSchema).min(1).max(2) }),
        )
        .max(100)
        .default([]),
    }),
    localAccounts: z.array(localAccountSeedSchema).max(100).default([]),
  })
  .superRefine((config, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (keys: string[]) => new Set(keys).size === keys.length;
    if (
      !unique(config.resources.map(resource => resource.id)) ||
      !unique(config.localAccounts.map(seed => seed.workspaceId))
    )
      issue('Duplicate resource or workspace.');
    if (
      !unique(config.mappings.entitlements) ||
      !unique(config.mappings.subscriptions) ||
      !unique(config.mappings.meters.map(meter => meter.key))
    )
      issue('Duplicate mapping.');
    for (const meter of config.mappings.meters) if (!unique(meter.funding)) issue('Duplicate funding mode.');
    const meters = new Map(config.mappings.meters.map(meter => [meter.key, meter]));
    for (const resource of config.resources) {
      if (
        !unique(resource.operations) ||
        resource.operations.some(operation =>
          resource.kind === 'agent' ? operation !== 'generate' : operation === 'generate',
        )
      )
        issue('Unsupported operation.');
      if (!unique(resource.measurements.map(measure => measure.key))) issue('Duplicate measurement.');
      const { access, charge } = resource.policy;
      if (access?.entitlement && !config.mappings.entitlements.includes(access.entitlement))
        issue('Unknown entitlement.');
      if (access?.subscription && !config.mappings.subscriptions.includes(access.subscription))
        issue('Unknown subscription.');
      if (charge.type === 'none') continue;
      const meter = meters.get(charge.meter);
      const funding = charge.type === 'credits' ? 'prepaid' : charge.funding;
      if (!meter || !meter.funding.includes(funding)) {
        issue('Unknown meter or unsupported funding.');
        continue;
      }
      if (charge.type === 'credits' && meter.unit !== 'credits') issue('Credits require credit units.');
      if (charge.type === 'per-task' && meter.unit !== 'tasks') issue('Task charging requires task units.');
      if (charge.type === 'usage') {
        const measure = resource.measurements.find(measure => measure.key === charge.measure);
        if (!measure || measure.unit !== meter.unit || (funding === 'prepaid' && !measure.enforceableBound))
          issue('Unsupported measurement or prepaid bound.');
      }
    }
    if (config.provider === 'local' && config.polar) issue('Polar configuration requires Polar mode.');
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
    for (const allowance of config.catalog.allowances)
      if (!meters.get(allowance.meter)?.funding.includes('prepaid')) issue('Unknown allowance meter or funding.');
    for (const offer of config.catalog.offers) {
      if (
        offer.entitlements.some(key => !config.mappings.entitlements.includes(key)) ||
        offer.subscriptions.some(key => !config.mappings.subscriptions.includes(key))
      )
        issue('Unknown offer access key.');
    }
    if (config.polar) {
      const bindings = polarCatalogConfigurationSchema.safeParse({ polar: config.polar, catalog: config.catalog });
      if (!bindings.success) issue('Invalid catalog provider bindings.');
    }
    if (config.provider !== 'local' && config.localAccounts.length > 0) issue('Local seeds require local mode.');
    for (const seed of config.localAccounts) {
      if (
        seed.entitlements.some(grant => !config.mappings.entitlements.includes(grant.key)) ||
        seed.subscriptions.some(grant => !config.mappings.subscriptions.includes(grant.key))
      )
        issue('Unknown commercial grant.');
      for (const meter of seed.meters)
        if (!meters.get(meter.key)?.funding.includes(meter.funding)) issue('Unknown seed meter or funding.');
    }
  });

export const billingConfigurationSchema = z.preprocess(input => {
  if (input === null || typeof input !== 'object' || !('polar' in input)) return input;
  const legacy = polarConfigurationSchema.safeParse(input.polar);
  if (!legacy.success) return input;
  if ('catalog' in input) return input;
  return { ...input, ...normalizeLegacyCatalog(legacy.data) };
}, canonicalConfigurationSchema);

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;
export type BillingConfiguration = DeepReadonly<z.infer<typeof billingConfigurationSchema>>;

export function freezeConfiguration<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeConfiguration(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function parseBillingConfiguration(input: unknown, capabilities: ProviderCapabilities): BillingConfiguration {
  const schema = canonicalConfigurationSchema.superRefine((configuration, ctx) => {
    for (const resource of configuration.resources) {
      const { access, charge } = resource.policy;
      if ((access?.entitlement && !capabilities.entitlements) || (access?.subscription && !capabilities.subscriptions))
        ctx.addIssue({ code: 'custom', message: 'Unsupported access capability.' });
      if (charge.type !== 'none') {
        const funding = charge.type === 'credits' ? 'prepaid' : charge.funding;
        if (
          !capabilities[funding] ||
          !capabilities.replaySafeUsage ||
          (funding === 'prepaid' &&
            capabilities.reconciliation !== 'reflected-events' &&
            capabilities.prepaidAuthority !== 'application-ledger')
        )
          ctx.addIssue({ code: 'custom', message: 'Unsupported accounting capability.' });
      }
    }
  });
  const normalized = billingConfigurationSchema.safeParse(input);
  const result = normalized.success ? schema.safeParse(normalized.data) : normalized;
  if (!result.success) throw new BillingError('invalid_configuration');
  return freezeConfiguration(result.data);
}

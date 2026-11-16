import { z } from 'zod';
import { prepaid, reservationBudgetSchema, workflowSuspensionTtlMs } from '../contracts/reservations.js';
import {
  BillingError,
  identifierSchema,
  positiveQuantitySchema,
  quantitySchema,
  timestampSchema,
} from '../contracts/core.js';
import { commercialCatalogSchema } from './catalog.js';
import type { ProviderCapabilities } from '../contracts/core.js';

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
  reservationBudget: reservationBudgetSchema.optional(),
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

export const billingConfigurationSchema = z
  .strictObject({
    provider: identifierSchema,
    hosted: z
      .strictObject({
        returnUrls: z
          .array(
            z.url().refine(value => {
              try {
                const url = new URL(value);
                return (
                  !url.username &&
                  !url.password &&
                  !url.hash &&
                  (url.protocol === 'https:' ||
                    (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
                );
              } catch {
                return false;
              }
            }),
          )
          .max(100)
          .default([]),
      })
      .default({ returnUrls: [] }),
    catalog: commercialCatalogSchema.default({ allowances: [], offers: [] }),
    resourcePolicies: z
      .array(
        z
          .strictObject({
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
          })
          .transform(resource =>
            resource.kind === 'workflow'
              ? {
                  ...resource,
                  policy: { ...resource.policy, suspendedReservationTtlMs: workflowSuspensionTtlMs(resource.policy) },
                }
              : resource,
          ),
      )
      .max(100),
    billingKeys: z.strictObject({
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
      !unique(config.resourcePolicies.map(resource => resource.id)) ||
      !unique(config.localAccounts.map(seed => seed.workspaceId))
    )
      issue('Duplicate resource or workspace.');
    if (
      !unique(config.billingKeys.entitlements) ||
      !unique(config.billingKeys.subscriptions) ||
      !unique(config.billingKeys.meters.map(meter => meter.key))
    )
      issue('Duplicate mapping.');
    for (const meter of config.billingKeys.meters) if (!unique(meter.funding)) issue('Duplicate funding mode.');
    const meters = new Map(config.billingKeys.meters.map(meter => [meter.key, meter]));
    for (const resource of config.resourcePolicies) {
      if (
        !unique(resource.operations) ||
        resource.operations.some(operation =>
          resource.kind === 'agent' ? operation !== 'generate' : operation === 'generate',
        )
      )
        issue('Unsupported operation.');
      if (!unique(resource.measurements.map(measure => measure.key))) issue('Duplicate measurement.');
      const { access, charge } = resource.policy;
      const budget = resource.policy.reservationBudget ?? reservationBudgetSchema.parse({});
      if (
        prepaid(resource.policy) &&
        (resource.policy.suspendedReservationTtlMs ?? 0) +
          budget.executionMs +
          budget.finalizationMs +
          budget.expiryMarginMs >
          budget.lifetimeMs
      )
        issue('Suspension, execution, finalization and expiry margin must fit the reservation lifetime.');
      if (access?.entitlement && !config.billingKeys.entitlements.includes(access.entitlement))
        issue('Unknown entitlement.');
      if (access?.subscription && !config.billingKeys.subscriptions.includes(access.subscription))
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
    for (const allowance of config.catalog.allowances)
      if (!meters.get(allowance.meter)?.funding.includes('prepaid')) issue('Unknown allowance meter or funding.');
    for (const offer of config.catalog.offers) {
      if (
        offer.entitlements.some(key => !config.billingKeys.entitlements.includes(key)) ||
        offer.subscriptions.some(key => !config.billingKeys.subscriptions.includes(key))
      )
        issue('Unknown offer access key.');
    }
    if (config.provider !== 'local' && config.localAccounts.length > 0) issue('Local seeds require local mode.');
    for (const seed of config.localAccounts) {
      if (
        seed.entitlements.some(grant => !config.billingKeys.entitlements.includes(grant.key)) ||
        seed.subscriptions.some(grant => !config.billingKeys.subscriptions.includes(grant.key))
      )
        issue('Unknown commercial grant.');
      for (const meter of seed.meters)
        if (!meters.get(meter.key)?.funding.includes(meter.funding)) issue('Unknown seed meter or funding.');
    }
  });

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
  const schema = billingConfigurationSchema.superRefine((configuration, ctx) => {
    for (const resource of configuration.resourcePolicies) {
      const { access, charge } = resource.policy;

      if ((access?.entitlement && !capabilities.entitlements) || (access?.subscription && !capabilities.subscriptions))
        ctx.addIssue({ code: 'custom', message: 'Unsupported access capability.' });
      if (charge.type !== 'none') {
        const funding = charge.type === 'credits' ? 'prepaid' : charge.funding;
        if (
          !capabilities[funding] ||
          (funding === 'metered' && !capabilities.replaySafeUsage) ||
          (funding === 'prepaid' &&
            capabilities.reconciliation !== 'reflected-events' &&
            capabilities.prepaidAuthority !== 'provider-reservations')
        )
          ctx.addIssue({ code: 'custom', message: 'Unsupported accounting capability.' });
      }
    }
  });
  const result = schema.safeParse(input);
  if (!result.success) throw new BillingError('invalid_configuration');
  return freezeConfiguration(result.data);
}

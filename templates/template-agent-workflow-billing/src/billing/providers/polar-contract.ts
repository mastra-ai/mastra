import { z } from 'zod';
import { identifierSchema, positiveQuantitySchema, quantitySchema, timestampSchema } from '../contracts.js';

const id = z.uuid();
const destination = z.url().refine(value => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.hash &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  );
});
export const polarConfigurationSchema = z
  .strictObject({
    server: z
      .url()
      .default('https://sandbox-api.polar.sh')
      .refine(value => {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/' &&
          (['https://sandbox-api.polar.sh', 'https://api.polar.sh'].includes(url.origin) ||
            (url.protocol === 'http:' && url.hostname === '127.0.0.1'))
        );
      }),
    organizationId: id,
    entitlements: z
      .array(z.strictObject({ key: identifierSchema, benefitId: id }))
      .max(100)
      .default([]),
    subscriptions: z
      .array(z.strictObject({ key: identifierSchema, productId: id }))
      .max(100)
      .default([]),
    grants: z
      .array(
        z
          .strictObject({
            meter: identifierSchema,
            version: identifierSchema,
            productId: id,
            priceId: id,
            benefitId: id,
            meterId: id,
            kind: z.enum(['order', 'subscription']),
            units: positiveQuantitySchema,
            expiry: z.discriminatedUnion('type', [
              z.strictObject({ type: z.literal('none') }),
              z.strictObject({ type: z.literal('duration'), milliseconds: positiveQuantitySchema }),
              z.strictObject({ type: z.literal('period') }),
            ]),
          })
          .refine(value => (value.kind === 'subscription') === (value.expiry.type === 'period')),
      )
      .max(100),
    meters: z
      .array(
        z.strictObject({
          key: identifierSchema,
          eventName: z.string().min(1).max(128),
          unitsField: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
          funding: z.enum(['prepaid', 'metered']).default('prepaid'),
          productId: id.optional(),
          priceId: id.optional(),
          meterId: id.optional(),
        }),
      )
      .max(100),
    products: z.array(z.strictObject({ key: identifierSchema, productId: id })).max(100),
    returnUrls: z.array(destination).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    for (const values of [value.entitlements, value.subscriptions, value.meters, value.products])
      if (new Set(values.map(entry => entry.key)).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate Polar mapping.' });
    if (new Set(value.grants.map(grant => `${grant.productId}:${grant.benefitId}`)).size !== value.grants.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate allocation mapping.' });
    for (const meter of value.meters)
      if (['execution_id', 'policy_version', 'resourceId', 'resourceKind'].includes(meter.unitsField))
        ctx.addIssue({ code: 'custom', message: 'Reserved event metadata field.' });
    for (const meter of value.meters)
      if (meter.funding === 'metered' && (!meter.productId || !meter.priceId || !meter.meterId))
        ctx.addIssue({ code: 'custom', message: 'Metered mappings require product, price and meter.' });
    if (value.grants.some(grant => !value.meters.some(meter => meter.key === grant.meter)))
      ctx.addIssue({ code: 'custom', message: 'Missing event mapping.' });
  });
export type PolarConfiguration = z.infer<typeof polarConfigurationSchema>;
export const billingContactSchema = z.strictObject({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(256).optional(),
});
export type BillingContactResolver = (workspaceId: string) => Promise<z.infer<typeof billingContactSchema>>;

// Validate fields this integration relies on, while allowing versioned provider
// payloads to include unrelated fields. Missing required evidence fails closed.
export const customerSchema = z.object({
  id,
  external_id: z.string(),
  organization_id: id,
  deleted_at: timestampSchema.nullable(),
});
export const benefitSchema = z.object({
  id,
  type: z.string(),
  is_deleted: z.boolean(),
  organization_id: id,
  properties: z.record(z.string(), z.unknown()),
});
export const priceSchema = z.object({
  id,
  amount_type: z.string(),
  is_archived: z.boolean().optional(),
  price_amount: quantitySchema.optional(),
  meter_id: id.optional(),
});
export const productSchema = z.object({
  id,
  organization_id: id,
  is_archived: z.boolean(),
  is_recurring: z.boolean(),
  prices: z.array(priceSchema).max(100),
  benefits: z.array(benefitSchema).max(100),
  recurring_interval: z.string().nullable(),
  recurring_interval_count: positiveQuantitySchema.nullable(),
  meter_interval: z.string().nullable(),
  meter_interval_count: positiveQuantitySchema.nullable(),
});
export const grantSchema = z.object({
  id,
  customer_id: id,
  benefit_id: id,
  subscription_id: id.nullable(),
  order_id: id.nullable(),
  is_granted: z.boolean(),
  is_revoked: z.boolean(),
  granted_at: timestampSchema.nullable().optional(),
  revoked_at: timestampSchema.nullable().optional(),
  benefit: benefitSchema,
  properties: z.record(z.string(), z.unknown()),
  error: z.unknown().optional(),
});
export const subscriptionSchema = z
  .object({
    id,
    customer_id: id,
    product_id: id,
    status: z.string(),
    current_period_start: timestampSchema,
    current_period_end: timestampSchema,
    current_meter_period_start: timestampSchema.nullable(),
    current_meter_period_end: timestampSchema.nullable(),
    prices: z.array(priceSchema).max(100),
    pending_update: z.unknown().nullable(),
    amount: quantitySchema,
  })
  .refine(value => Date.parse(value.current_period_end) > Date.parse(value.current_period_start));
export const orderSchema = z.object({
  id,
  customer_id: id,
  product_id: id.nullable(),
  subscription_id: id.nullable(),
  status: z.string(),
  paid: z.boolean(),
  created_at: timestampSchema,
  refunded_amount: quantitySchema,
  refunded_tax_amount: quantitySchema,
  billing_reason: z.string(),
  items: z.array(z.object({ product_price_id: id.nullable(), proration: z.boolean() })).max(100),
});
export const stateSchema = customerSchema.extend({
  active_subscriptions: z
    .array(
      z.object({
        id,
        status: z.string(),
        product_id: id,
        current_period_start: timestampSchema,
        current_period_end: timestampSchema,
      }),
    )
    .max(10000),
  granted_benefits: z.array(z.object({ id, benefit_id: id, granted_at: timestampSchema })).max(10000),
});
export const sessionUrlSchema = destination;

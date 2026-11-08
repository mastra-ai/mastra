import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BillingError, accountSchema, identifierSchema, quantitySchema, timestampSchema } from './contracts.js';
import type { CommercialSnapshot } from './contracts.js';
import type { BillingConfiguration } from './configuration.js';

export type ResourceConfiguration = BillingConfiguration['resources'][number];
export type BillingPolicy = ResourceConfiguration['policy'];
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// Inspect descriptors before reading values: accessors, cycles and SDK instances
// are never invoked or serialized. Limits bound both validation and replay size.
export function boundedJson(input: unknown): Json {
  let nodes = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): Json {
    if (++nodes > 2048 || depth > 12) throw new BillingError('invalid_input');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string' && value.length <= 16384) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
    if (typeof value !== 'object' || value === null || ancestors.has(value)) throw new BillingError('invalid_input');
    const array = Array.isArray(value);
    if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new BillingError('invalid_input');
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
    if (keys.length > 256 || keys.some(key => typeof key !== 'string')) throw new BillingError('invalid_input');
    const output: Json[] | Record<string, Json> = array ? [] : Object.create(null);
    if (array && keys.length !== (value as unknown[]).length) throw new BillingError('invalid_input');
    for (const key of (keys as string[]).sort()) {
      const descriptor = descriptors[key];
      if (
        !('value' in descriptor) ||
        !descriptor.enumerable ||
        key.length > 128 ||
        ['__proto__', 'constructor', 'prototype'].includes(key)
      )
        throw new BillingError('invalid_input');
      // Equal property count plus contiguous in-range indices excludes holes
      // and numeric non-index properties that JSON.stringify would omit.
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= keys.length))
        throw new BillingError('invalid_input');
      (output as Record<string, Json>)[key] = visit(descriptor.value, depth + 1);
    }
    ancestors.delete(value);
    return output;
  }
  const result = visit(input, 0);
  if (Buffer.byteLength(JSON.stringify(result)) > 16384) throw new BillingError('invalid_input');
  return result;
}
export const boundedJsonSchema = z.unknown().transform((value, ctx): Json => {
  try {
    return boundedJson(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'A bounded JSON projection is required.' });
    return z.NEVER;
  }
});
export const fingerprint = (input: Json) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
export const operationSchema = z.enum(['generate', 'start', 'resume', 'cancel']);
export const executionRequestSchema = z.strictObject({
  resourceId: identifierSchema,
  operation: z.enum(['generate', 'start']),
  idempotencyKey: identifierSchema,
  input: boundedJsonSchema,
});
const measurementSchema = z.strictObject({ id: identifierSchema, measure: identifierSchema, units: quantitySchema });
export const outcomeSchema = z
  .strictObject({
    status: z.enum(['succeeded', 'failed', 'canceled', 'uncertain', 'suspended']),
    result: boundedJsonSchema.optional(),
    measurements: z.array(measurementSchema).max(100).default([]),
    measurementComplete: z.boolean().default(false),
  })
  .superRefine((outcome, ctx) => {
    if (outcome.status === 'succeeded' && outcome.result === undefined)
      ctx.addIssue({ code: 'custom', message: 'Success requires a replay projection.' });
  });
export type ExecutorOutcome = z.input<typeof outcomeSchema>;
export interface BoundedExecutor {
  readonly resourceId: string;
  readonly operation: z.infer<typeof operationSchema>;
  readonly measurements: readonly {
    readonly key: string;
    readonly maxUnits: number;
    readonly enforceableBound?: boolean;
  }[];
  execute(
    input: Json,
    budget: Readonly<{ executionId: string; maxUnits: number | null; measure: string | null }>,
  ): Promise<ExecutorOutcome>;
}
export interface AdmissionIdentity {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly credentialHash: string | null;
  readonly commercial?: { accountId: string; revision: string };
  readonly validUntil: number | null;
}
export const receiptSchema = z.strictObject({
  executionId: identifierSchema,
  workspaceId: identifierSchema,
  policyVersion: identifierSchema,
  executionStatus: z.enum(['running', 'completed', 'failed', 'canceled', 'uncertain']),
  settlementStatus: z.enum(['not_required', 'reserved', 'pending', 'settled', 'released', 'uncertain']),
  deliveryStatus: z.enum(['not_required', 'pending', 'accepted', 'reconciled', 'retrying', 'failed', 'uncertain']),
  observedUnits: quantitySchema.nullable(),
  billedUnits: quantitySchema.nullable(),
  replayed: z.boolean(),
});
export interface BillingResponse {
  readonly result: Json | null;
  readonly billing: z.infer<typeof receiptSchema>;
}
const grantSchema = z.strictObject({
  key: identifierSchema,
  validFrom: timestampSchema,
  validUntil: timestampSchema.nullable(),
});
export const snapshotSchema = z
  .strictObject({
    account: accountSchema,
    observedAt: timestampSchema,
    validUntil: timestampSchema.nullable(),
    entitlements: z.array(grantSchema).max(100),
    subscriptions: z.array(grantSchema).max(100),
    meters: z
      .array(
        z.strictObject({
          key: identifierSchema,
          funding: z.enum(['prepaid', 'metered']),
          confirmedBalance: quantitySchema.nullable(),
          consumedUnits: quantitySchema,
          periodStart: timestampSchema.nullable(),
          periodEnd: timestampSchema.nullable(),
        }),
      )
      .max(100),
    evidence: z.strictObject({ version: identifierSchema }).nullable(),
    prepaidAuthority: z.literal('application-ledger').optional(),
  })
  .superRefine(refineCommercialState);

export function refineCommercialState(
  snapshot: Pick<CommercialSnapshot, 'entitlements' | 'subscriptions' | 'meters'>,
  ctx: z.RefinementCtx,
) {
  for (const entries of [snapshot.entitlements, snapshot.subscriptions, snapshot.meters])
    if (new Set(entries.map(entry => entry.key)).size !== entries.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate key.' });
  for (const grant of [...snapshot.entitlements, ...snapshot.subscriptions])
    if (grant.validUntil !== null && Date.parse(grant.validUntil) <= Date.parse(grant.validFrom))
      ctx.addIssue({ code: 'custom', message: 'Invalid grant.' });
  for (const meter of snapshot.meters)
    if (
      (meter.funding === 'prepaid') !== (meter.confirmedBalance !== null) ||
      (meter.periodStart === null) !== (meter.periodEnd === null) ||
      (meter.periodStart !== null &&
        meter.periodEnd !== null &&
        Date.parse(meter.periodStart) >= Date.parse(meter.periodEnd))
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid meter.' });
}

export function reservation(policy: BillingPolicy): number {
  const charge = policy.charge;
  return charge.type === 'none' ? 0 : charge.type === 'usage' ? charge.maxUnits : charge.units;
}
export function needsCommercialState(policy: BillingPolicy): boolean {
  return policy.charge.type !== 'none' || policy.access !== undefined;
}
export function eligible(policy: BillingPolicy, snapshot: CommercialSnapshot, now: number): void {
  if (
    Date.parse(snapshot.observedAt) > now ||
    (snapshot.validUntil !== null && Date.parse(snapshot.validUntil) <= now) ||
    snapshot.evidence === null
  )
    throw new BillingError('state_unavailable');
  for (const [key, grants] of [
    [policy.access?.entitlement, snapshot.entitlements],
    [policy.access?.subscription, snapshot.subscriptions],
  ] as const)
    if (
      key &&
      !grants.some(
        grant =>
          grant.key === key &&
          Date.parse(grant.validFrom) <= now &&
          (grant.validUntil === null || Date.parse(grant.validUntil) > now),
      )
    )
      throw new BillingError('forbidden');
  const charge = policy.charge;
  if (charge.type === 'none') return;
  const funding = charge.type === 'credits' ? 'prepaid' : charge.funding;
  const meter = snapshot.meters.find(meter => meter.key === charge.meter && meter.funding === funding);
  if (
    !meter ||
    (meter.periodStart !== null && Date.parse(meter.periodStart) > now) ||
    (meter.periodEnd !== null && Date.parse(meter.periodEnd) <= now)
  )
    throw new BillingError('forbidden');
}

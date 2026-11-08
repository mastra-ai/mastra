import { commercialCatalogSchema, catalogReferenceSchema, resolveAllowance } from '../../src/billing/catalog.js';
import { describe, expect, it } from 'vitest';
import { parseBillingConfiguration } from '../../src/billing/configuration.js';
import { localCapabilities } from '../../src/billing/providers/local.js';
import { configuration } from '../support/billing.js';

describe('billing policy configuration', () => {
  it.each([
    { type: 'none' },
    { type: 'credits', meter: 'credits', units: 3 },
    { type: 'per-task', meter: 'tasks', units: 1, funding: 'prepaid' },
    { type: 'per-task', meter: 'tasks', units: 1, funding: 'metered' },
    { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 100, funding: 'prepaid' },
    { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 100, funding: 'metered' },
  ])('accepts success-only agent charge $type with $funding funding', charge => {
    const input = configuration();
    Object.assign(input.resources[0].policy, {
      charge,
      access: { entitlement: 'access', subscription: 'subscription' },
    });
    expect(parseBillingConfiguration(input, localCapabilities).resources[0].policy).toEqual({
      version: 'v1',
      charge,
      access: { entitlement: 'access', subscription: 'subscription' },
    });
  });

  it('supports free and subscription-only access without a consumption charge', () => {
    const input = configuration();
    input.resources[0].policy = { version: 'v1', charge: { type: 'none' } };
    input.resources[1].policy = { version: 'v1', access: { subscription: 'subscription' }, charge: { type: 'none' } };
    expect(
      parseBillingConfiguration(input, localCapabilities).resources.map(resource => resource.policy.charge),
    ).toEqual([{ type: 'none' }, { type: 'none' }]);
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe fixed charge %s', units => {
    const input = configuration();
    Object.assign(input.resources[0].policy.charge, { units });
    expect(() => parseBillingConfiguration(input, localCapabilities)).toThrow(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
  });

  it.each([
    [
      'empty access guard',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resources[0].policy, { access: {} }),
    ],
    [
      'unknown entitlement',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, { access: { entitlement: 'missing' } }),
    ],
    [
      'unknown subscription',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, { access: { subscription: 'missing' } }),
    ],
    [
      'unknown meter',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy.charge, { meter: 'missing' }),
    ],
    ['duplicate resource', (input: ReturnType<typeof configuration>) => input.resources.push(input.resources[0])],
    [
      'duplicate mapping',
      (input: ReturnType<typeof configuration>) => input.mappings.meters.push(input.mappings.meters[0]),
    ],
    [
      'unknown resource mapping',
      (input: ReturnType<typeof configuration>) => Object.assign(input, { policies: { missing: {} } }),
    ],
    [
      'duplicate operation',
      (input: ReturnType<typeof configuration>) => input.resources[0].operations.push('generate'),
    ],
    [
      'unsupported operation',
      (input: ReturnType<typeof configuration>) => input.resources[0].operations.push('resume'),
    ],
    [
      'unsupported execution mode',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resources[0], { mode: 'stream' }),
    ],
    [
      'failed-charge override',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resources[0].policy, { chargeOn: 'failure' }),
    ],
    [
      'fractional expiry',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, { suspendedReservationTtlMs: 0.5 }),
    ],
    [
      'wrong task unit',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, {
          charge: { type: 'per-task', meter: 'credits', units: 1, funding: 'prepaid' },
        }),
    ],
    [
      'wrong credit unit',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resources[0].policy.charge, { meter: 'tokens' }),
    ],
    [
      'unsupported funding',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, {
          charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'debt' },
        }),
    ],
    [
      'unknown measurement',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, {
          charge: { type: 'usage', meter: 'tokens', measure: 'missing', maxUnits: 100, funding: 'metered' },
        }),
    ],
    [
      'unbounded prepaid measurement',
      (input: ReturnType<typeof configuration>) => {
        input.resources[0].measurements[0].enforceableBound = false;
        Object.assign(input.resources[0].policy, {
          charge: { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 100, funding: 'prepaid' },
        });
      },
    ],
    [
      'zero usage bound',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resources[0].policy, {
          charge: { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 0, funding: 'metered' },
        }),
    ],
    [
      'negative balance',
      (input: ReturnType<typeof configuration>) => {
        input.localAccounts[0].meters[0].balance = -1;
      },
    ],
    [
      'metered credit balance',
      (input: ReturnType<typeof configuration>) => {
        input.localAccounts[0].meters[1].balance = 100;
      },
    ],
    [
      'reversed eligibility dates',
      (input: ReturnType<typeof configuration>) => {
        input.localAccounts[0].subscriptions[0].validUntil = '2010-01-01T00:00:00Z';
      },
    ],
  ])('rejects %s before storage exists', (_name, mutate) => {
    const input = configuration();
    mutate(input);
    expect(() => parseBillingConfiguration(input, localCapabilities)).toThrow(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
  });

  it.each(['prepaid', 'replaySafeUsage', 'entitlements', 'subscriptions'] as const)(
    'rejects missing provider capability %s',
    capability => {
      const input = configuration();
      input.resources[0].policy.access = { entitlement: 'access', subscription: 'subscription' };
      expect(() => parseBillingConfiguration(input, { ...localCapabilities, [capability]: false })).toThrow(
        expect.objectContaining({ code: 'invalid_configuration' }),
      );
    },
  );

  it('denies prepaid registration without reflected-event evidence', () => {
    expect(() =>
      parseBillingConfiguration(configuration(), { ...localCapabilities, reconciliation: 'unverified' }),
    ).toThrow(expect.objectContaining({ code: 'invalid_configuration' }));
  });

  it('keeps parsed policy and seed configuration immutable and detached from caller input', () => {
    const input = configuration();
    const parsed = parseBillingConfiguration(input, localCapabilities);
    input.resources[0].policy.version = 'changed';
    expect(parsed.resources[0].policy.version).toBe('v1');
    expect(() => Object.assign(parsed.resources[0].policy.charge, { units: 999 })).toThrow(TypeError);
    expect(() => Object.assign(parsed.localAccounts[0].meters[0], { balance: 999 })).toThrow(TypeError);
    expect(() => (parsed.mappings.meters as unknown[]).push({})).toThrow(TypeError);
  });
});

describe('commercial catalog revisions', () => {
  const terms = {
    key: 'credit-pack',
    version: 'credits-v1',
    meter: 'credits',
    kind: 'order',
    units: 100,
    expiry: { type: 'duration', milliseconds: 86400000 },
  };
  const catalog = () => ({
    allowances: [structuredClone(terms)],
    offers: [{ key: 'team-plan', version: 'v1', allowances: [{ key: 'credit-pack', version: 'credits-v1' }] }],
  });

  it('shares immutable application terms across independent provider references', () => {
    const parsed = commercialCatalogSchema.parse(catalog());
    const polar = {
      allowance: catalogReferenceSchema.parse({ key: 'credit-pack', version: 'credits-v1' }),
      productId: 'polar-product',
    };
    const stripe = {
      allowance: catalogReferenceSchema.parse({ key: 'credit-pack', version: 'credits-v1' }),
      priceId: 'stripe-price',
    };
    expect(resolveAllowance(parsed, polar.allowance)).toEqual(terms);
    expect(resolveAllowance(parsed, stripe.allowance)).toEqual(terms);
    const reordered = commercialCatalogSchema.parse({
      allowances: [terms],
      offers: [{ key: 'two', version: 'v1', entitlements: ['b', 'a'] }],
    });
    expect(
      commercialCatalogSchema.parse({ ...reordered, offers: [{ ...reordered.offers[0], entitlements: ['a', 'b'] }] }),
    ).toEqual(reordered);
    const next = structuredClone(terms);
    next.version = 'credits-v2';
    next.units = 200;
    parsed.allowances.push(commercialCatalogSchema.parse({ allowances: [next] }).allowances[0]);
    expect(resolveAllowance(parsed, polar.allowance)?.units).toBe(100);
    expect(resolveAllowance(parsed, { key: terms.key, version: 'credits-v2' })?.units).toBe(200);
  });

  it.each([
    ['duplicate revision', (value: ReturnType<typeof catalog>) => value.allowances.push(value.allowances[0])],
    ['missing revision', (value: ReturnType<typeof catalog>) => (value.offers[0].allowances[0].version = 'missing')],
    [
      'unsafe quantity',
      (value: ReturnType<typeof catalog>) => (value.allowances[0].units = Number.MAX_SAFE_INTEGER + 1),
    ],
    [
      'subscription without period expiry',
      (value: ReturnType<typeof catalog>) => (value.allowances[0].kind = 'subscription'),
    ],
    [
      'unexpected provider term',
      (value: ReturnType<typeof catalog>) => Object.assign(value.allowances[0], { productId: 'external' }),
    ],
  ])('rejects %s before commercial admission', (_name, change) => {
    const input = catalog();
    change(input);
    expect(commercialCatalogSchema.safeParse(input).success).toBe(false);
  });
});

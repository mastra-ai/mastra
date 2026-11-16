import {
  commercialCatalogSchema,
  catalogReferenceSchema,
  resolveAllowance,
} from '../../src/billing/configuration/catalog.js';
import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfigurationFiles } from '../../src/billing/configuration/files.js';
import { parseBillingConfiguration } from '../../src/billing/configuration/policy.js';
import { localCapabilities } from '../../src/billing/providers/local/index.js';
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
    Object.assign(input.resourcePolicies[0].policy, {
      charge,
      access: { entitlement: 'access', subscription: 'subscription' },
    });
    expect(parseBillingConfiguration(input, localCapabilities).resourcePolicies[0].policy).toEqual({
      version: 'v1',
      charge,
      access: { entitlement: 'access', subscription: 'subscription' },
    });
  });

  it('supports free and subscription-only access without a consumption charge', () => {
    const input = configuration();
    input.resourcePolicies[0].policy = { version: 'v1', charge: { type: 'none' } };
    input.resourcePolicies[1].policy = {
      version: 'v1',
      access: { subscription: 'subscription' },
      charge: { type: 'none' },
    };
    expect(
      parseBillingConfiguration(input, localCapabilities).resourcePolicies.map(resource => resource.policy.charge),
    ).toEqual([{ type: 'none' }, { type: 'none' }]);
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe fixed charge %s', units => {
    const input = configuration();
    Object.assign(input.resourcePolicies[0].policy.charge, { units });
    expect(() => parseBillingConfiguration(input, localCapabilities)).toThrow(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
  });

  it.each([
    [
      'empty access guard',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resourcePolicies[0].policy, { access: {} }),
    ],
    [
      'unknown entitlement',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, { access: { entitlement: 'missing' } }),
    ],
    [
      'unknown subscription',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, { access: { subscription: 'missing' } }),
    ],
    [
      'unknown meter',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy.charge, { meter: 'missing' }),
    ],
    [
      'duplicate resource',
      (input: ReturnType<typeof configuration>) => input.resourcePolicies.push(input.resourcePolicies[0]),
    ],
    [
      'duplicate mapping',
      (input: ReturnType<typeof configuration>) => input.billingKeys.meters.push(input.billingKeys.meters[0]),
    ],
    [
      'unknown resource mapping',
      (input: ReturnType<typeof configuration>) => Object.assign(input, { policies: { missing: {} } }),
    ],
    [
      'duplicate operation',
      (input: ReturnType<typeof configuration>) => input.resourcePolicies[0].operations.push('generate'),
    ],
    [
      'unsupported operation',
      (input: ReturnType<typeof configuration>) => input.resourcePolicies[0].operations.push('resume'),
    ],
    [
      'unsupported execution mode',
      (input: ReturnType<typeof configuration>) => Object.assign(input.resourcePolicies[0], { mode: 'stream' }),
    ],
    [
      'failed-charge override',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, { chargeOn: 'failure' }),
    ],
    [
      'fractional expiry',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, { suspendedReservationTtlMs: 0.5 }),
    ],
    [
      'wrong task unit',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, {
          charge: { type: 'per-task', meter: 'credits', units: 1, funding: 'prepaid' },
        }),
    ],
    [
      'wrong credit unit',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy.charge, { meter: 'tokens' }),
    ],
    [
      'unsupported funding',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, {
          charge: { type: 'per-task', meter: 'tasks', units: 1, funding: 'debt' },
        }),
    ],
    [
      'unknown measurement',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, {
          charge: { type: 'usage', meter: 'tokens', measure: 'missing', maxUnits: 100, funding: 'metered' },
        }),
    ],
    [
      'unbounded prepaid measurement',
      (input: ReturnType<typeof configuration>) => {
        input.resourcePolicies[0].measurements[0].enforceableBound = false;
        Object.assign(input.resourcePolicies[0].policy, {
          charge: { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 100, funding: 'prepaid' },
        });
      },
    ],
    [
      'zero usage bound',
      (input: ReturnType<typeof configuration>) =>
        Object.assign(input.resourcePolicies[0].policy, {
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

  it.each(['prepaid', 'entitlements', 'subscriptions'] as const)(
    'rejects missing provider capability %s',
    capability => {
      const input = configuration();
      input.resourcePolicies[0].policy.access = { entitlement: 'access', subscription: 'subscription' };
      expect(() => parseBillingConfiguration(input, { ...localCapabilities, [capability]: false })).toThrow(
        expect.objectContaining({ code: 'invalid_configuration' }),
      );
    },
  );

  it('denies prepaid registration without reflected-event evidence', () => {
    expect(() =>
      parseBillingConfiguration(configuration(), {
        ...localCapabilities,
        prepaidAuthority: undefined,
        reconciliation: 'unverified',
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_configuration' }));
  });

  it('accepts remote prepaid reservations without replayable usage and rejects postpaid without it', () => {
    const capabilities = { ...localCapabilities, replaySafeUsage: false, reconciliation: 'unverified' as const };
    expect(parseBillingConfiguration(configuration(), capabilities).resourcePolicies[0].policy.charge.type).toBe(
      'credits',
    );
    const input = configuration();
    input.resourcePolicies[0].policy.charge = {
      type: 'usage',
      meter: 'tokens',
      measure: 'token-count',
      maxUnits: 10,
      funding: 'metered',
    };
    expect(() => parseBillingConfiguration(input, capabilities)).toThrow(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
  });

  it.each([
    { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 2999 },
    { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 0, lifetimeMs: 5000 },
    { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 86400001 },
  ])('rejects impossible finite reservation budgets', reservationBudget => {
    const input = configuration();
    input.resourcePolicies[0].policy.reservationBudget = reservationBudget;
    expect(() => parseBillingConfiguration(input, localCapabilities)).toThrow(
      expect.objectContaining({ code: 'invalid_configuration' }),
    );
  });

  it.each([{ type: 'none' }, { type: 'per-task', meter: 'tasks', units: 1, funding: 'metered' }] as const)(
    'preserves a 24-hour suspension policy without a prepaid hold for $type',
    charge => {
      const input = configuration();
      Object.assign(input.resourcePolicies[1].policy, { charge, suspendedReservationTtlMs: 86_400_000 });
      expect(
        parseBillingConfiguration(input, localCapabilities).resourcePolicies[1].policy.suspendedReservationTtlMs,
      ).toBe(86_400_000);
    },
  );

  it('keeps parsed policy and seed configuration immutable and detached from caller input', () => {
    const input = configuration();
    const parsed = parseBillingConfiguration(input, localCapabilities);
    input.resourcePolicies[0].policy.version = 'changed';
    expect(parsed.resourcePolicies[0].policy.version).toBe('v1');
    expect(() => Object.assign(parsed.resourcePolicies[0].policy.charge, { units: 999 })).toThrow(TypeError);
    expect(() => Object.assign(parsed.localAccounts[0].meters[0], { balance: 999 })).toThrow(TypeError);
    expect(() => (parsed.billingKeys.meters as unknown[]).push({})).toThrow(TypeError);
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
    const productBinding = {
      allowance: catalogReferenceSchema.parse({ key: 'credit-pack', version: 'credits-v1' }),
      productId: 'external-product',
    };
    const stripe = {
      allowance: catalogReferenceSchema.parse({ key: 'credit-pack', version: 'credits-v1' }),
      priceId: 'stripe-price',
    };
    expect(resolveAllowance(parsed, productBinding.allowance)).toEqual(terms);
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
    expect(resolveAllowance(parsed, productBinding.allowance)?.units).toBe(100);
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

it.each(['not-a-url', 'https://['])('malformed hosted return URL %s produces a configuration error', async url => {
  const input = { ...configuration(), hosted: { returnUrls: [url] } };
  expect(() => parseBillingConfiguration(input, localCapabilities)).toThrow(
    expect.objectContaining({ code: 'invalid_configuration' }),
  );
  const root = await mkdtemp(join(tmpdir(), 'billing-url-'));
  try {
    await writeFile(join(root, 'billing.json'), JSON.stringify(input));
    expect(() =>
      validateConfigurationFiles({ BILLING_PROJECT_ROOT: root, BILLING_CONFIG_FILE: 'billing.json' }),
    ).toThrow(expect.objectContaining({ code: 'invalid_configuration' }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(['https://app.example/done', 'http://localhost:4111/done', 'http://127.0.0.1:4111/done'])(
  'hosted return URL %s remains valid',
  url => {
    expect(
      parseBillingConfiguration({ ...configuration(), hosted: { returnUrls: [url] } }, localCapabilities).hosted
        .returnUrls,
    ).toEqual([url]);
  },
);

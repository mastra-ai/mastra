import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  BillingError,
  identifierSchema,
  parseInput,
  timestampSchema,
  usageEventSchema,
} from '../../src/billing/contracts.js';
import { driverObservationSchema, externalAccountSchema } from '../../src/billing/driver.js';
import type { GrantSource } from '../../src/billing/contracts.js';
import type { BillingDriver, ExternalAccount } from '../../src/billing/driver.js';
import type { CommercialCatalog } from '../../src/billing/catalog.js';

// A second external provider boundary used by the public gateway suite. It has
// no SQL imports, database argument or access to application storage.
export async function referenceDriver(
  catalog: CommercialCatalog,
  options: { validFrom?: string; hosted?: boolean; webhookSecret?: string; id?: string; metered?: boolean } = {},
) {
  const id = options.id ?? 'reference';
  const returnUrl = 'https://app.example.test/billing';
  const allowance = catalog.allowances.find(value => value.kind === 'order')!;
  const validFrom = options.validFrom ?? '2025-01-01T00:00:00Z';
  const data = {
    available: true,
    metered: options.metered ?? false,
    wrongAccount: false,
    sources: true,
    units: allowance.units,
    allowance: { key: allowance.key, version: allowance.version },
    sourceOverrides: {} as Partial<GrantSource>,
    sourceKey: 'shared-purchase',
    access: true,
    rawRequests: [] as string[],
    hostedRequests: [] as { operation: string; body: unknown }[],
    webhookBodies: [] as Uint8Array[],
    events: new Map<string, string>(),
  };
  const link = (workspaceId: string): ExternalAccount => ({
    customerId: `customer:${workspaceId}`,
    organizationId: 'reference-org',
    externalReference: `workspace:${workspaceId}`,
  });
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const body = raw ? JSON.parse(raw) : null;
    response.setHeader('content-type', 'application/json');
    const reply = (value: unknown) => response.end(JSON.stringify(value));
    if (!data.available) {
      response.statusCode = 503;
      reply({});
      return;
    }
    if (request.url === '/account') {
      reply(link(body.workspaceId));
      return;
    }
    if (request.url === '/observation') {
      const provenance = JSON.stringify({
        sourceId: data.sourceKey,
        allowance: { key: allowance.key, version: allowance.version },
        meter: allowance.meter,
        kind: allowance.kind,
        units: allowance.units,
        version: allowance.version,
        expiry: allowance.expiry,
        validFrom,
      });
      const now = new Date(Date.now() - 1000).toISOString();
      reply({
        account: data.wrongAccount ? link('foreign') : link(body.workspaceId),
        sources: data.sources
          ? [
              {
                allowance: data.allowance,
                source: {
                  key: data.sourceKey,
                  meter: allowance.meter,
                  kind: allowance.kind,
                  units: data.units,
                  provenance,
                  fingerprint: createHash('sha256').update(provenance).digest('hex'),
                  validFrom,
                  validUntil:
                    allowance.expiry.type === 'duration'
                      ? new Date(Date.parse(validFrom) + allowance.expiry.milliseconds).toISOString()
                      : null,
                  active: true,
                  ...data.sourceOverrides,
                },
              },
            ]
          : [],
        commercial: {
          entitlements: data.access ? [{ key: 'access', validFrom: now, validUntil: null }] : [],
          subscriptions: data.access ? [{ key: 'subscription', validFrom: now, validUntil: null }] : [],
          meters: data.metered
            ? [
                {
                  key: 'tasks',
                  funding: 'metered',
                  confirmedBalance: null,
                  consumedUnits: 0,
                  periodStart: null,
                  periodEnd: null,
                },
              ]
            : [],
        },
      });
      return;
    }
    if (request.url === '/usage') {
      data.rawRequests.push(raw);
      const duplicate = data.events.has(body.event.id);
      data.events.set(body.event.id, raw);
      reply({ status: duplicate ? 'duplicate' : 'accepted', eventId: body.event.id });
      return;
    }
    if (request.url === '/checkout' || request.url === '/portal') {
      data.hostedRequests.push({ operation: request.url, body });
      reply({ status: 'created', url: `https://sessions.example.test/${id}/${data.hostedRequests.length}` });
      return;
    }
    response.statusCode = 404;
    reply({});
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  const origin = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, body: unknown) => {
    const response = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new BillingError('state_unavailable');
    return response.json();
  };
  const bindingSchema = z.strictObject({ origin: z.url(), organizationId: z.literal('reference-org') });
  const claimSchema = z.strictObject({
    event: usageEventSchema,
    request: z.strictObject({ origin: z.url(), organizationId: z.literal('reference-org') }),
  });
  const driver: BillingDriver = {
    id,
    publicBindings: JSON.stringify({ origin, allowance: { key: allowance.key, version: allowance.version } }),
    capabilities: {
      entitlements: true,
      subscriptions: true,
      prepaid: true,
      metered: options.metered ?? false,
      replaySafeUsage: true,
      reconciliation: 'unverified',
      prepaidAuthority: 'application-ledger',
      checkout: options.hosted ?? false,
      portal: options.hosted ?? false,
      webhooks: Boolean(options.webhookSecret),
    },
    ensureAccount: async profile => parseInput(externalAccountSchema, await request('/account', profile)),
    validateAccount(account, evidence) {
      if (
        account.provider !== id ||
        evidence.organizationId !== 'reference-org' ||
        evidence.externalReference !== account.externalReference
      )
        throw new BillingError('conflict');
    },
    observe: async account =>
      parseInput(driverObservationSchema, await request('/observation', { workspaceId: account.workspaceId })),
    bindUsage: meter => ({
      provider: id,
      meter,
      version: 1,
      data: JSON.stringify({ origin, organizationId: 'reference-org' }),
    }),
    normalizeUsage(event, binding) {
      if (binding.provider !== id || binding.version !== 1 || binding.meter !== event.meter)
        throw new BillingError('conflict');
      const mapping = parseInput(bindingSchema, JSON.parse(binding.data));
      if (mapping.origin !== origin) throw new BillingError('state_unavailable');
      return JSON.stringify(claimSchema.parse({ event, request: mapping }));
    },
    validateUsage(payload, event, binding) {
      const claim = parseInput(claimSchema, JSON.parse(payload));
      if (
        JSON.stringify(claim.event) !== JSON.stringify(usageEventSchema.parse(event)) ||
        claim.request.origin !== origin ||
        (binding && payload !== this.normalizeUsage(event, binding))
      )
        throw new BillingError('conflict');
    },
    async sendUsage(payload) {
      const claim = parseInput(claimSchema, JSON.parse(payload));
      const response = await fetch(`${claim.request.origin}/usage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
      if (!response.ok) return { status: 'uncertain', code: 'reference_unavailable' };
      return parseInput(
        z.strictObject({ status: z.enum(['accepted', 'duplicate']), eventId: z.string() }),
        await response.json(),
      );
    },
    async prepareCheckout(input) {
      if (!options.hosted) throw new BillingError('unsupported');
      if (input.returnUrl !== returnUrl || !catalog.offers.some(offer => offer.key === input.product))
        throw new BillingError('invalid_input');
      return {
        status: 'prepared',
        dispatch: async () =>
          parseInput(z.strictObject({ status: z.literal('created'), url: z.url() }), await request('/checkout', input)),
      };
    },
    async preparePortalSession(input) {
      if (!options.hosted) throw new BillingError('unsupported');
      if (input.returnUrl !== returnUrl) throw new BillingError('invalid_input');
      return {
        status: 'prepared',
        dispatch: async () =>
          parseInput(z.strictObject({ status: z.literal('created'), url: z.url() }), await request('/portal', input)),
      };
    },
    async verifyWebhook(input) {
      if (!options.webhookSecret) throw new BillingError('unsupported');
      const eventId = input.headers['webhook-id'];
      const timestamp = input.headers['webhook-timestamp'];
      const signature = input.headers['webhook-signature'];
      const expected = createHmac('sha256', options.webhookSecret)
        .update(`${eventId}.${timestamp}.`)
        .update(input.body)
        .digest('hex');
      if (
        !identifierSchema.safeParse(eventId).success ||
        !/^\d+$/.test(timestamp ?? '') ||
        Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
        !/^[a-f0-9]{64}$/.test(signature ?? '') ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        throw new BillingError('unauthenticated');
      const payload = parseInput(
        z.strictObject({ account: z.string().nullable(), occurredAt: timestampSchema }),
        JSON.parse(Buffer.from(input.body).toString()),
      );
      data.webhookBodies.push(input.body);
      return {
        status: 'verified',
        id: eventId,
        digest: createHash('sha256').update(input.body).digest('hex'),
        type: 'account.updated',
        accountReference: payload.account,
        occurredAt: payload.occurredAt,
      };
    },
  };
  return {
    driver,
    data,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

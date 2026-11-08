import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { billingConfigurationSchema } from '../../src/billing/configuration.js';
import { JwtIdentityAdapter } from '../../src/billing/identity.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { initializeBilling } from '../../src/billing/setup.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import type { BoundedExecutor } from '../../src/billing/accounting.js';
import { CommercialStorage } from '../../src/billing/storage/commercial.js';
import { CommercialService } from '../../src/billing/commercial.js';
import { temporaryDatabase, independentClient } from './billing.js';

export async function polarWire() {
  const ids = {
    organization: randomUUID(),
    customer: randomUUID(),
    order: randomUUID(),
    subscription: randomUUID(),
    orderProduct: randomUUID(),
    subscriptionProduct: randomUUID(),
    orderPrice: randomUUID(),
    subscriptionPrice: randomUUID(),
    orderBenefit: randomUUID(),
    subscriptionBenefit: randomUUID(),
    meter: randomUUID(),
  };
  const start = new Date(Date.now() - 3600_000).toISOString();
  const end = new Date(Date.now() + 3600_000).toISOString();
  const benefit = (id: string, units: number) => ({
    id,
    type: 'meter_credit',
    is_deleted: false,
    organization_id: ids.organization,
    properties: { units, rollover: false, meter_id: ids.meter },
  });
  const product = (recurring: boolean) => ({
    id: recurring ? ids.subscriptionProduct : ids.orderProduct,
    organization_id: ids.organization,
    is_archived: false,
    is_recurring: recurring,
    recurring_interval: recurring ? 'month' : null,
    recurring_interval_count: recurring ? 1 : null,
    meter_interval: null,
    meter_interval_count: null,
    prices: [{ id: recurring ? ids.subscriptionPrice : ids.orderPrice, amount_type: 'fixed', price_amount: 0 }],
    benefits: [benefit(recurring ? ids.subscriptionBenefit : ids.orderBenefit, recurring ? 4 : 6)],
  });
  const order = (id = ids.order) => ({
    id,
    customer_id: ids.customer,
    product_id: ids.orderProduct,
    subscription_id: null,
    status: 'paid',
    paid: true,
    created_at: start,
    refunded_amount: 0,
    refunded_tax_amount: 0,
    billing_reason: 'purchase',
    items: [{ product_price_id: ids.orderPrice, proration: false }],
  });
  const grant = (recurring: boolean, orderId = ids.order) => ({
    id: randomUUID(),
    customer_id: ids.customer,
    benefit_id: recurring ? ids.subscriptionBenefit : ids.orderBenefit,
    subscription_id: recurring ? ids.subscription : null,
    order_id: recurring ? null : orderId,
    is_granted: true,
    is_revoked: false,
    granted_at: start,
    revoked_at: null,
    benefit: benefit(recurring ? ids.subscriptionBenefit : ids.orderBenefit, recurring ? 4 : 6),
    properties: {},
    error: null,
  });
  const data = {
    customer: null as null | { id: string; external_id: string; organization_id: string; deleted_at: null },
    orders: [order()],
    subscriptions: [
      {
        id: ids.subscription,
        customer_id: ids.customer,
        product_id: ids.subscriptionProduct,
        status: 'active',
        current_period_start: start,
        current_period_end: end,
        current_meter_period_start: null as string | null,
        current_meter_period_end: null as string | null,
        prices: [{ id: ids.subscriptionPrice, amount_type: 'fixed', price_amount: 0 }],
        pending_update: null,
        amount: 0,
      },
    ],
    grants: [grant(false), grant(true)],
    products: [product(false), product(true)],
    unavailable: false,
    truncated: false,
    wrongVersion: false,
    lostCustomer: false,
    lostUsage: false,
    lostHosted: false,
    malformed: false,
    rejectUsage: false,
    pause: undefined as undefined | { path: string; reached: () => void; release: Promise<void> },
    requests: [] as { method: string; path: string; body: any; version: string | undefined }[],
    events: new Map<string, unknown>(),
    hosted: 0,
    creations: 0,
    addOrder() {
      const value = order(randomUUID());
      this.orders.push(value);
      this.grants.push(grant(false, value.id));
    },
  };
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    const url = new URL(req.url!, 'http://127.0.0.1');
    data.requests.push({
      method: req.method!,
      path: url.pathname,
      body,
      version: req.headers['polar-version'] as string,
    });
    res.setHeader('Polar-Version', data.wrongVersion ? '2025-01' : '2026-10');
    res.setHeader('Content-Type', 'application/json');
    const reply = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(value));
    };
    if (req.headers.authorization !== 'Bearer loopback-test-token') return reply({}, 401);
    if (data.unavailable) return reply({}, 503);
    if (data.malformed) return reply({ unexpected: true });
    // Organization access tokens are already scoped. Polar rejects an explicit
    // organization_id even when it equals the token's owning organization.
    if (
      (url.pathname === '/v1/customers/' && req.method === 'POST' && body.organization_id !== undefined) ||
      (url.pathname === '/v1/events/ingest' && body.events.some((event: any) => event.organization_id !== undefined))
    )
      return reply({ detail: [{ type: 'organization_token', loc: ['body', 'organization_id'] }] }, 422);
    if (url.pathname.startsWith('/v1/customers/external/'))
      return data.customer ? reply(data.customer) : reply({}, 404);
    if (url.pathname === '/v1/customers/' && req.method === 'POST') {
      data.creations++;
      data.customer = {
        id: ids.customer,
        external_id: body.external_id,
        organization_id: ids.organization,
        deleted_at: null,
      };
      if (data.lostCustomer) {
        data.lostCustomer = false;
        req.socket.destroy();
        return;
      }
      return reply(data.customer, 201);
    }
    if (url.pathname === `/v1/customers/${ids.customer}/state`)
      return reply({
        ...data.customer,
        active_subscriptions: data.subscriptions.filter(
          value => value.status === 'active' && Date.parse(value.current_period_end) > Date.now(),
        ),
        granted_benefits: data.grants
          .filter(value => value.is_granted && !value.is_revoked)
          .map(value => ({ id: value.id, benefit_id: value.benefit_id, granted_at: value.granted_at })),
      });
    const lists: Record<string, unknown[]> = {
      '/v1/orders/': data.orders,
      '/v1/subscriptions/': data.subscriptions,
      '/v1/benefit-grants/': data.grants,
    };
    const values = lists[url.pathname];
    if (values) {
      const page = Number(url.searchParams.get('page'));
      const limit = 2; // Multiple real HTTP pages exercise completeness checks.
      return reply({
        items: values.slice((page - 1) * limit, page * limit),
        pagination: {
          total_count: values.length + (data.truncated ? 1 : 0),
          max_page: Math.ceil(values.length / limit),
        },
      });
    }
    if (data.pause?.path === url.pathname) {
      const pause = data.pause;
      data.pause = undefined;
      pause.reached();
      await pause.release;
    }
    if (url.pathname.startsWith('/v1/products/'))
      return reply(data.products.find(value => url.pathname.endsWith(value.id)));
    if (url.pathname === '/v1/events/ingest') {
      if (data.rejectUsage) return reply({}, 422);
      const event = body.events[0];
      const duplicate = data.events.has(event.external_id);
      data.events.set(event.external_id, event);
      if (data.lostUsage) {
        data.lostUsage = false;
        req.socket.destroy();
        return;
      }
      return reply({ inserted: duplicate ? 0 : 1, duplicates: duplicate ? 1 : 0 });
    }
    if (['/v1/checkouts/', '/v1/customer-sessions/'].includes(url.pathname)) {
      data.hosted++;
      if (data.lostHosted) {
        req.socket.destroy();
        return;
      }
      return reply({
        url: 'https://sandbox.polar.sh/checkout/session',
        customer_portal_url: 'https://sandbox.polar.sh/portal/session',
        customer_id: ids.customer,
        product_id: body.products?.[0],
        return_url: body.return_url,
        success_url: body.success_url,
      });
    }
    return reply({}, 404);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP address');
  return {
    ids,
    data,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

export async function polarFixture(
  options: { webhookSecret?: string; units?: number; executor?: BoundedExecutor['execute'] } = {},
) {
  const database = await temporaryDatabase();
  const wire = await polarWire();
  const storage = await OrganizationStorage.open({ url: database.url });
  const keys = await generateKeyPair('EdDSA');
  const identity = new JwtIdentityAdapter(storage, {
    issuer: 'https://identity.example.test',
    audience: 'billing',
    algorithms: ['EdDSA'],
    jwks: { keys: [await exportJWK(keys.publicKey)] },
  });
  const organizations = new OrganizationService(storage, { identity, mode: 'production', provider: 'polar' });
  const profile = async (subject: string) => {
    const user = await organizations.provisionJwt({
      issuer: 'https://identity.example.test',
      subject,
      displayName: subject,
    });
    const credential = await new SignJWT({ email: 'untrusted@example.test' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(subject)
      .setIssuer('https://identity.example.test')
      .setAudience('billing')
      .setExpirationTime('1h')
      .sign(keys.privateKey);
    return { ...user, credential, context: await organizations.context({ credential }) };
  };
  const owner = await profile('owner');
  const ids = wire.ids;
  const configuration = billingConfigurationSchema.parse({
    provider: 'polar',
    resources: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: options.units ?? 3 } },
      },
    ],
    mappings: {
      entitlements: ['access'],
      subscriptions: ['subscription'],
      meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }],
    },
    polar: {
      server: wire.url,
      organizationId: ids.organization,
      entitlements: [{ key: 'access', benefitId: ids.subscriptionBenefit }],
      subscriptions: [{ key: 'subscription', productId: ids.subscriptionProduct }],
      grants: [
        {
          meter: 'credits',
          version: 'v1',
          productId: ids.orderProduct,
          priceId: ids.orderPrice,
          benefitId: ids.orderBenefit,
          meterId: ids.meter,
          kind: 'order',
          units: 6,
          expiry: { type: 'none' },
        },
        {
          meter: 'credits',
          version: 'v1',
          productId: ids.subscriptionProduct,
          priceId: ids.subscriptionPrice,
          benefitId: ids.subscriptionBenefit,
          meterId: ids.meter,
          kind: 'subscription',
          units: 4,
          expiry: { type: 'period' },
        },
      ],
      meters: [{ key: 'credits', eventName: 'work.succeeded', unitsField: 'units' }],
      products: [{ key: 'credit-pack', productId: ids.orderProduct }],
      returnUrls: ['https://app.example.test/billing'],
    },
  });
  const initialization = {
    configuration,
    storage: { url: database.url },
    polar: {
      token: 'loopback-test-token',
      webhookSecret: options.webhookSecret,
      contact: async () => ({ email: 'trusted@example.test', name: 'Workspace billing' }),
    },
  };
  const commercial = await initializeBilling(initialization);
  const accounting = await AccountingStorage.open({ url: database.url }, storage);
  let calls = 0;
  const gateway = new BillingGateway(organizations, accounting, commercial.provider, configuration, [
    {
      resourceId: 'assistant',
      operation: 'generate',
      measurements: [],
      execute: async (input, budget) => {
        calls++;
        return options.executor ? options.executor(input, budget) : { status: 'succeeded', result: { answer: 'done' } };
      },
    },
  ]);
  const sessionStorage = await CommercialStorage.open({ url: database.url }, storage);
  const sessions = new CommercialService(organizations, sessionStorage, commercial.provider, commercial.configuration);
  const observer = await independentClient(database.url);
  const execute = (key: string, context = owner.context) =>
    gateway.execute(context, {
      resourceId: 'assistant',
      operation: 'generate',
      idempotencyKey: key,
      input: { prompt: 'weather' },
    });
  return {
    database,
    wire,
    organizations,
    owner,
    profile,
    configuration,
    initialization,
    jwks: { keys: [await exportJWK(keys.publicKey)] },
    commercial,
    accounting,
    gateway,
    sessions,
    observer,
    execute,
    calls: () => calls,
    close: async () => {
      observer.close();
      sessionStorage.close();
      accounting.close();
      commercial.close();
      organizations.close();
      await wire.close();
      await database.cleanup();
    },
  };
}

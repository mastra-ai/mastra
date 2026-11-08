import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@libsql/client/node';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { z } from 'zod';
import type { PolarConfiguration } from '../src/billing/providers/polar-contract.js';
import { initializeBilling } from '../src/billing/setup.js';
import { billingConfigurationSchema } from '../src/billing/configuration.js';
import { JwtIdentityAdapter } from '../src/billing/identity.js';
import { OrganizationService } from '../src/billing/organizations.js';
import { OrganizationStorage } from '../src/billing/storage/organizations.js';
import { AccountingStorage } from '../src/billing/storage/accounting.js';
import { BillingGateway } from '../src/billing/gateway.js';

// Explicit opt-in only. This script provisions zero-price disposable sandbox
// products/customer/subscription/checkout; it never targets production.
const options = z
  .strictObject({
    organizationId: z.uuid(),
    databaseUrl: z.string().startsWith('file:///'),
    contactEmail: z.email(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('BR'),
  })
  .parse(JSON.parse(process.env.POLAR_SANDBOX_PROOF ?? 'null'));
const token = process.env.POLAR_ACCESS_TOKEN;
if (!token) throw new Error('An explicitly selected sandbox credential is required.');
const upstream = 'https://sandbox-api.polar.sh';
const namespace = `awb-proof-${randomUUID()}`;
const suppliedPath = fileURLToPath(options.databaseUrl);
const databaseUrl = pathToFileURL(join(dirname(suppliedPath), `${basename(suppliedPath, '.db')}-${namespace}.db`)).href;
const [contactLocal, contactDomain] = options.contactEmail.split('@');
const uniqueContact = `${contactLocal.split('+')[0].slice(0, 16)}+${namespace.slice(-20)}@${contactDomain}`;
const headers = { Authorization: `Bearer ${token}`, 'Polar-Version': '2026-10', 'Content-Type': 'application/json' };
async function api(method: string, path: string, body?: unknown): Promise<any> {
  const response = await fetch(`${upstream}/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || response.headers.get('Polar-Version') !== '2026-10')
    throw new Error(`Sandbox fixture request failed (${response.status}).`);
  return response.json();
}
async function poll<T>(operation: () => Promise<T>, ready: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const value = await operation();
    if (ready(value)) return value;
    await setTimeout(750);
  }
  throw new Error('Sandbox source evidence did not converge within the observation bound.');
}

const debug = process.env.POLAR_SANDBOX_DEBUG === '1';
const phase = (path: string, method: string | undefined) =>
  path.includes('/customers/external/')
    ? 'customer-lookup'
    : path === '/v1/customers/' && method === 'POST'
      ? 'customer-create'
      : path.includes('/state')
        ? 'customer-state'
        : path.includes('/benefit-grants/')
          ? 'benefit-grants'
          : path.includes('/subscriptions/')
            ? 'subscriptions'
            : path.includes('/orders/')
              ? 'orders'
              : path.includes('/products/')
                ? 'product'
                : path.includes('/events/ingest')
                  ? 'usage'
                  : 'other';
function diagnostic(value: Record<string, unknown>) {
  if (debug) console.error(JSON.stringify({ sandboxDiagnostic: value }));
}
let discardUsageResponse = false;
// A transparent socket proxy discards one real ingestion acknowledgement after
// Polar responds. It invents no provider data and never logs headers or bodies.
const proxy = createServer(async (request, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const response = await fetch(`${upstream}${request.url}`, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method!) ? undefined : Buffer.concat(chunks),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (debug) {
      let shape: Record<string, unknown> = {};
      try {
        const value = JSON.parse(bytes.toString()) as Record<string, unknown>;
        const kind = (input: unknown) => (input === null ? 'null' : Array.isArray(input) ? 'array' : typeof input);
        shape = {
          fields: Object.fromEntries(
            ['id', 'external_id', 'organization_id', 'deleted_at', 'detail', 'error'].map(key => [
              key,
              kind(value[key]),
            ]),
          ),
        };
        if (phase(request.url!, request.method) === 'customer-create') {
          const submitted = JSON.parse(Buffer.concat(chunks).toString());
          shape = {
            ...shape,
            externalIdMatches: value.external_id === submitted.external_id,
            organizationMatches: value.organization_id === options.organizationId,
          };
        }
      } catch {
        shape = { json: 'invalid' };
      }
      diagnostic({
        phase: phase(request.url!, request.method),
        status: response.status,
        version: response.headers.get('Polar-Version'),
        ...shape,
      });
    }
    if (request.url === '/v1/events/ingest' && discardUsageResponse) {
      discardUsageResponse = false;
      request.socket.destroy();
      return;
    }
    outgoing.setHeader('Polar-Version', response.headers.get('Polar-Version') ?? '');
    outgoing.setHeader('Content-Type', 'application/json');
    outgoing.writeHead(response.status);
    outgoing.end(bytes);
  } catch (error) {
    const code =
      error !== null &&
      typeof error === 'object' &&
      'cause' in error &&
      error.cause !== null &&
      typeof error.cause === 'object' &&
      'code' in error.cause
        ? String(error.cause.code)
        : 'unknown';
    diagnostic({
      phase: phase(request.url!, request.method),
      transportError: /^[A-Z_]{1,80}$/.test(code) ? code : 'unknown',
    });
    outgoing.writeHead(503);
    outgoing.end('{}');
  }
});
proxy.listen(0, '127.0.0.1');
await once(proxy, 'listening');
const address = proxy.address();
assert(address && typeof address !== 'string');
await mkdir(dirname(fileURLToPath(databaseUrl)), { recursive: true });
const directory = await OrganizationStorage.open({ url: databaseUrl });
const keys = await generateKeyPair('EdDSA');
const organizations = new OrganizationService(directory, {
  identity: new JwtIdentityAdapter(directory, {
    issuer: 'https://sandbox-proof.example.test',
    audience: namespace,
    algorithms: ['EdDSA'],
    jwks: { keys: [await exportJWK(keys.publicKey)] },
  }),
  mode: 'production',
  provider: 'polar',
});
const owner = await organizations.provisionJwt({
  issuer: 'https://sandbox-proof.example.test',
  subject: namespace,
  displayName: 'Sandbox proof workspace',
});
const credential = await new SignJWT({})
  .setProtectedHeader({ alg: 'EdDSA' })
  .setIssuer('https://sandbox-proof.example.test')
  .setAudience(namespace)
  .setSubject(namespace)
  .setExpirationTime('15m')
  .sign(keys.privateKey);
const context = await organizations.context({ credential });
let billing: Awaited<ReturnType<typeof initializeBilling>> | undefined;
let accounting: AccountingStorage | undefined;
const sql = createClient({ url: databaseUrl, intMode: 'bigint' });
try {
  const tags = { test_run: namespace, purpose: 'verified-application-prepaid-proof' };
  const meter = await api('POST', '/meters/', {
    name: namespace,
    filter: { conjunction: 'and', clauses: [{ property: 'name', operator: 'eq', value: namespace }] },
    aggregation: { func: 'sum', property: 'units' },
    metadata: tags,
  });
  const mappings: PolarConfiguration['grants'] = [];
  for (const [kind, units] of [
    ['order', 6],
    ['subscription', 4],
  ] as const) {
    const benefit = await api('POST', '/benefits/', {
      type: 'meter_credit',
      description: `AWB ${namespace.slice(-20)} ${kind}`,
      properties: { meter_id: meter.id, units, rollover: false },
      metadata: tags,
    });
    const product = await api('POST', '/products/', {
      name: `${namespace} ${kind}`,
      visibility: 'private',
      recurring_interval: kind === 'subscription' ? 'month' : null,
      prices: [{ amount_type: 'fixed', price_amount: 0, price_currency: 'usd' }],
      metadata: tags,
    });
    await api('POST', `/products/${product.id}/benefits`, { benefits: [benefit.id] });
    mappings.push({
      kind,
      units,
      benefitId: benefit.id,
      productId: product.id,
      priceId: product.prices[0].id,
      meterId: meter.id,
      meter: kind === 'order' ? 'purchase-credits' : 'period-credits',
      version: 'v1',
      expiry: kind === 'order' ? { type: 'none' as const } : { type: 'period' as const },
    });
  }
  const configuration = billingConfigurationSchema.parse({
    provider: 'polar',
    resources: mappings.map(mapping => ({
      id: mapping.kind,
      kind: 'agent',
      operations: ['generate'],
      policy: {
        version: 'v1',
        charge: { type: 'credits', meter: mapping.meter, units: mapping.kind === 'order' ? 3 : 2 },
      },
    })),
    mappings: { meters: mappings.map(mapping => ({ key: mapping.meter, unit: 'credits', funding: ['prepaid'] })) },
    polar: {
      server: `http://127.0.0.1:${address.port}`,
      organizationId: options.organizationId,
      grants: mappings,
      meters: mappings.map(mapping => ({ key: mapping.meter, eventName: namespace, unitsField: 'units' })),
      products: [{ key: 'purchase', productId: mappings[0].productId }],
      returnUrls: ['http://localhost:4111/billing/test-return'],
    },
  });
  const initialization = {
    configuration,
    storage: { url: databaseUrl },
    polar: { token, contact: async () => ({ email: uniqueContact, name: 'Disposable sandbox workspace' }) },
  };
  billing = await initializeBilling(initialization);
  const account = await billing.provider.ensureAccount({ workspaceId: owner.workspaceId });
  const customer = await api('GET', `/customers/external/${encodeURIComponent(account.externalReference)}`);
  const checkout = await api('POST', '/checkouts/', {
    products: [mappings[0].productId],
    customer_id: customer.id,
    customer_billing_address: { country: options.country },
    success_url: configuration.polar!.returnUrls[0],
    return_url: configuration.polar!.returnUrls[0],
    metadata: tags,
  });
  assert.equal(checkout.total_amount, 0);
  const confirmation = await api('POST', `/checkouts/client/${encodeURIComponent(checkout.client_secret)}/confirm`, {
    customer_billing_address: { country: options.country },
  });
  assert.equal(confirmation.status, 'confirmed');
  assert.equal(confirmation.total_amount, 0);
  const subscription = await api('POST', '/subscriptions/', {
    customer_id: customer.id,
    product_id: mappings[1].productId,
    metadata: tags,
  });
  await poll(
    () => api('GET', `/orders/?customer_id=${customer.id}&limit=100`),
    value =>
      value.items.some(
        (order: any) => order.product_id === mappings[0].productId && order.paid && order.status === 'paid',
      ),
  );
  await poll(
    () => api('GET', `/benefit-grants/?customer_id=${customer.id}&limit=100`),
    value =>
      mappings.every(mapping =>
        value.items.some(
          (grant: any) => grant.benefit_id === mapping.benefitId && grant.is_granted && !grant.is_revoked,
        ),
      ),
  );
  const first = await billing.provider.getState(account);
  assert.equal(first.prepaidAuthority, 'application-ledger');
  assert.deepEqual(first.meters.map(value => [value.key, value.confirmedBalance]).sort(), [
    ['period-credits', 4],
    ['purchase-credits', 6],
  ]);
  accounting = await AccountingStorage.open({ url: databaseUrl }, directory);
  const gateway = new BillingGateway(
    organizations,
    accounting,
    billing.provider,
    configuration,
    mappings.map(mapping => ({
      resourceId: mapping.kind,
      operation: 'generate' as const,
      measurements: [],
      execute: async () => ({ status: 'succeeded' as const, result: { report: 'deterministic sandbox work' } }),
    })),
  );
  for (const mapping of mappings) {
    const response = await gateway.execute(context, {
      resourceId: mapping.kind,
      operation: 'generate',
      idempotencyKey: `spend-${mapping.kind}`,
      input: {},
    });
    assert.equal(response.billing.billedUnits, mapping.kind === 'order' ? 3 : 2);
  }
  const beforeExport = (
    await sql.execute('SELECT source_key, original_units, consumed_units FROM credit_grants ORDER BY source_key')
  ).rows;
  assert.equal(beforeExport.length, 2);
  assert.deepEqual(beforeExport.map(row => Number(row.consumed_units)).sort(), [2, 3]);
  const events = (await sql.execute('SELECT payload FROM billing_outbox ORDER BY id')).rows.map(row =>
    JSON.parse(String(row.payload)),
  );
  discardUsageResponse = true;
  assert.equal((await billing.provider.reportUsage(events[0])).status, 'uncertain');
  billing.close();
  billing = await initializeBilling(initialization);
  assert.deepEqual(await billing.provider.ensureAccount({ workspaceId: owner.workspaceId }), account);
  assert.equal((await billing.provider.reportUsage(events[0])).status, 'duplicate');
  assert.equal((await billing.provider.reportUsage(events[1])).status, 'accepted');
  assert.equal((await billing.provider.reportUsage(events[1])).status, 'duplicate');
  for (let repetition = 0; repetition < 3; repetition++) await billing.provider.getState(account);
  assert.deepEqual(
    (await sql.execute('SELECT source_key, original_units, consumed_units FROM credit_grants ORDER BY source_key'))
      .rows,
    beforeExport,
  );
  // Revoke only this disposable recurring source. One-time unused units and
  // historical successful consumption survive independently of remote meters.
  await api('PATCH', `/subscriptions/${subscription.id}`, { revoke: true });
  await poll(
    () => api('GET', `/benefit-grants/?customer_id=${customer.id}&limit=100`),
    value => value.items.some((grant: any) => grant.subscription_id === subscription.id && grant.is_revoked),
  );
  await billing.provider.getState(account);
  const after = (
    await sql.execute('SELECT kind, original_units, consumed_units, available FROM credit_grants ORDER BY kind')
  ).rows;
  assert.deepEqual(
    after.map(row => ({
      kind: row.kind,
      original: Number(row.original_units),
      consumed: Number(row.consumed_units),
      available: Number(row.available),
    })),
    [
      { kind: 'order', original: 6, consumed: 3, available: 1 },
      { kind: 'subscription', original: 4, consumed: 2, available: 0 },
    ],
  );
  assert.equal((await sql.execute('PRAGMA foreign_key_check')).rows.length, 0);
  console.log(
    JSON.stringify({
      test: 'Polar sandbox proves verified grant funding and replay-safe usage without balance coupling',
      status: 'passed',
      environment: 'sandbox',
      apiVersion: '2026-10',
      grants: 2,
      originalUnits: 10,
      consumedUnits: 5,
      usageEvents: 2,
      recurringRevocation: 'verified',
      databaseUrl,
    }),
  );
} finally {
  sql.close();
  accounting?.close();
  billing?.close();
  organizations.close();
  await new Promise<void>(resolve => {
    proxy.close(() => resolve());
    proxy.closeAllConnections();
  });
}

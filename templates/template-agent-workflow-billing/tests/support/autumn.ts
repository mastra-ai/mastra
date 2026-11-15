import { createServer } from 'node:http';
import { once } from 'node:events';
import { BillingGateway } from '../../src/billing/runtime/gateway.js';
import { AutumnBillingProvider } from '../../src/billing/providers/autumn/index.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import type { ExecutorOutcome } from '../../src/billing/runtime/accounting.js';
import { identityFixture } from './identity.js';

// Only the external Autumn API is controlled. SDK, HTTP socket, authentication,
// gateway, SQL transactions, projections and restart all execute normally.
export async function autumnFixture() {
  const identity = await identityFixture();
  const requests: { path: string; body: Record<string, any>; version: string | undefined }[] = [];
  const locks = new Map<string, number>();
  const logs: Record<string, unknown>[] = [];
  const hooks: { afterReserve?: () => Promise<void>; beforeFinalize?: () => Promise<void> } = {};
  const behavior = {
    environment: 'sandbox',
    balance: 10,
    consumed: 0,
    dropReserve: false,
    dropFinalize: false,
    reserveStatus: 200,
    finalizeStatus: 200,
    visibleLogs: true,
    cost: 1,
    unlimited: false,
    overage: false,
    missingBalance: false,
    featureId: 'generated_images',
    creditPoolId: 'image_credits',
    checkoutUrl: 'https://checkout.example.test/test-session',
    portalUrl: 'https://portal.example.test/test-session',
  };
  const balance = () => ({
    feature_id: behavior.creditPoolId,
    remaining: behavior.balance - [...locks.values()].reduce((sum, units) => sum + units, 0),
    usage: behavior.consumed + [...locks.values()].reduce((sum, units) => sum + units, 0),
    granted: 10,
    unlimited: behavior.unlimited,
    overage_allowed: behavior.overage,
    max_purchase: null,
    next_reset_at: null,
    breakdown: [],
  });
  const customer = {
    id: 'johns-org',
    name: "John's Org",
    email: null,
    created_at: 1,
    fingerprint: null,
    stripe_id: null,
    env: 'sandbox',
    metadata: {},
    send_email_receipts: false,
    billing_controls: {},
    subscriptions: [],
    purchases: [],
    licenses: [],
    balances: {},
    flags: {},
  };
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const path = new URL(req.url!, 'http://127.0.0.1').pathname;
    requests.push({ path, body, version: req.headers['x-api-version'] as string | undefined });
    let status = 200;
    let output: unknown;
    if (path.includes('customers.')) output = { ...customer, id: body.customer_id, env: behavior.environment };
    else if (path === '/v1/billing.attach')
      output = { customer_id: body.customer_id, payment_url: behavior.checkoutUrl };
    else if (path === '/v1/billing.open_customer_portal')
      output = { customer_id: body.customer_id, url: behavior.portalUrl };
    else if (path === '/v1/features.get')
      output =
        body.feature_id === behavior.featureId
          ? { id: behavior.featureId, name: 'Generated Images', type: 'metered', consumable: true, archived: false }
          : {
              id: behavior.creditPoolId,
              name: 'Image Credits',
              type: 'credit_system',
              consumable: true,
              archived: false,
              credit_schema: [{ metered_feature_id: behavior.featureId, billing_units: 1, credit_cost: behavior.cost }],
            };
    else if (path === '/v1/balances.check') {
      status = body.lock ? behavior.reserveStatus : 200;
      let allowed = !behavior.missingBalance && balance().remaining >= (body.required_balance ?? 1);
      if (body.lock && locks.has(body.lock.lock_id)) {
        status = 409;
        allowed = false;
      }
      if (body.lock && status === 200 && allowed) locks.set(body.lock.lock_id, body.required_balance);
      output = {
        allowed,
        customer_id: body.customer_id,
        required_balance: body.required_balance ?? 1,
        balance: behavior.missingBalance ? null : balance(),
        flag: null,
      };
      if (body.lock && status === 200 && allowed) await hooks.afterReserve?.();
      if (body.lock && behavior.dropReserve) {
        behavior.dropReserve = false;
        req.socket.destroy();
        return;
      }
    } else if (path === '/v1/balances.finalize') {
      status = behavior.finalizeStatus;
      await hooks.beforeFinalize?.();
      const units = locks.get(body.lock_id);
      if (units === undefined) status = 400;
      if (status === 200) {
        locks.delete(body.lock_id);
        if (body.action === 'confirm') {
          behavior.balance -= body.override_value ?? units!;
          behavior.consumed += body.override_value ?? units!;
        }
      }
      output = status === 200 ? { success: true } : { code: 'invalid_request', message: 'Lock not found' };
      logs.push({
        timestamp: new Date().toISOString(),
        source: 'api',
        status_code: status,
        request: { method: 'POST', url: null, path },
        context: {
          org_id: null,
          customer_id: 'johns-org',
          entity_id: null,
          auth_type: 'secret_key',
          user_id: null,
          user_email: null,
        },
        stripe: { event_id: null, event_type: null, object_id: null },
        request_body: body,
        response_body: output,
      });
      if (behavior.dropFinalize) {
        behavior.dropFinalize = false;
        req.socket.destroy();
        return;
      }
    } else if (path === '/v1/logs.search') {
      const start = body.range?.start_date ? Date.parse(body.range.start_date) : Date.now() - 30 * 60_000;
      const end = body.range?.end_date ? Date.parse(body.range.end_date) : Date.now();
      output = {
        list: behavior.visibleLogs
          ? logs.filter(log => Date.parse(String(log.timestamp)) >= start && Date.parse(String(log.timestamp)) <= end)
          : [],
      };
    } else {
      status = 404;
      output = {};
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(output));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected bound HTTP server.');
  const options = {
    secretKey: 'controlled-sandbox-key',
    serverURL: `http://127.0.0.1:${address.port}`,
    timeoutMs: 1000,
    bindings: {
      customers: [{ workspaceId: identity.owner.workspaceId, customerId: 'johns-org' }],
      meters: [{ key: 'credits', featureId: 'generated_images', creditPoolId: 'image_credits' }],
      plans: [{ key: 'credit-pack', planId: 'test-image-pack' }],
      returnUrls: ['https://app.example.test/billing'],
    },
  };
  let provider = await AutumnBillingProvider.open({ url: identity.database.url }, options);
  let storage = await AccountingStorage.open({ url: identity.database.url }, identity.organizations.storage);
  let computes = 0;
  const configuration = {
    ...identity.configuration,
    resourcePolicies: identity.configuration.resourcePolicies.map(resource => ({
      ...resource,
      policy: { ...resource.policy },
    })),
    provider: 'autumn',
  };
  let outcome: ExecutorOutcome | (() => Promise<ExecutorOutcome>) = {
    status: 'succeeded',
    result: { answer: 'private' },
  };
  const gateway = () =>
    new BillingGateway(identity.organizations, storage, provider, configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => {
          computes++;
          return typeof outcome === 'function' ? outcome() : outcome;
        },
      },
    ]);
  return {
    options,
    jwtConfiguration: identity.jwtConfiguration,
    database: identity.database,
    organizations: identity.organizations,
    context: identity.owner.context,
    owner: identity.owner,
    profile: identity.profile,
    behavior,
    hooks,
    requests,
    logs,
    locks,
    provider: () => provider,
    storage: () => storage,
    computes: () => computes,
    observer: identity.observer,
    configuration,
    outcome: (value: ExecutorOutcome | (() => Promise<ExecutorOutcome>)) => {
      outcome = value;
    },
    execute: (key: string) =>
      gateway().execute(identity.owner.context, {
        resourceId: 'assistant',
        operation: 'generate',
        idempotencyKey: key,
        input: { prompt: 'hello' },
      }),
    read: (id: string) => gateway().read(identity.owner.context, id),
    restart: async (bindings = options.bindings) => {
      provider.close();
      storage.close();
      provider = await AutumnBillingProvider.open({ url: identity.database.url }, { ...options, bindings });
      storage = await AccountingStorage.open({ url: identity.database.url }, identity.organizations.storage);
      gateway();
    },
    close: async () => {
      storage.close();
      provider.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await identity.close();
    },
  };
}

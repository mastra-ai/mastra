import { BillingGateway } from '../../src/billing/gateway.js';
import { initializeBilling } from '../../src/billing/setup.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import type { UsageEvent } from '../../src/billing/contracts.js';
import { polarFixture } from './polar.js';
import { referenceDriver } from './reference-driver.js';

export const contractProviders = ['local', 'polar', 'reference'] as const;

export async function providerContractFixture(provider: (typeof contractProviders)[number]) {
  // Reuse real JWT organization/SQL infrastructure and the external Polar wire.
  // No account exists until the selected provider admits its first execution.
  const f = await polarFixture();
  const reference =
    provider === 'reference' ? await referenceDriver(f.configuration.catalog, { hosted: true }) : undefined;
  const initialBalance = provider === 'reference' ? 6 : 10;
  const configuration = {
    ...f.configuration,
    provider,
    polar: provider === 'polar' ? f.configuration.polar : undefined,
    localAccounts:
      provider === 'local'
        ? [
            {
              workspaceId: f.owner.workspaceId,
              meters: [{ key: 'credits', funding: 'prepaid', balance: initialBalance }],
            },
          ]
        : [],
  };
  const open = (input: unknown = configuration, url = f.database.url) =>
    initializeBilling({
      configuration: input,
      storage: { url },
      ...(provider === 'polar' ? { polar: f.initialization.polar } : {}),
      ...(reference ? { drivers: [reference.driver] } : {}),
    });
  let billing = await open();
  let accounting = await AccountingStorage.open({ url: f.database.url }, f.organizations.storage);
  let calls = 0;
  const gateway = () =>
    new BillingGateway(f.organizations, accounting, billing.provider, configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => {
          calls++;
          return { status: 'succeeded', result: { answer: 'done' } };
        },
      },
    ]);
  const events = async (): Promise<UsageEvent[]> =>
    (await f.observer.execute('SELECT payload FROM billing_outbox ORDER BY rowid')).rows.map(row =>
      JSON.parse(String(row.payload)),
    );
  const exportRows = () =>
    f.observer.execute(`SELECT * FROM ${provider === 'local' ? 'immutable_usage' : 'provider_usage'} ORDER BY rowid`);
  const exported = async () => {
    if (provider === 'polar')
      return f.wire.data.requests
        .filter(value => value.path === '/v1/events/ingest')
        .map(value => {
          const event = value.body.events[0];
          return { id: event.external_id, units: event.metadata.units, account: event.external_customer_id };
        });
    const payloads = reference
      ? reference.data.rawRequests.map(value => JSON.parse(value).event as UsageEvent)
      : (await exportRows()).rows.map(row => JSON.parse(String(row.payload)) as UsageEvent);
    return payloads.map(event => ({ id: event.id, units: event.units, account: event.account.externalReference }));
  };
  return {
    initialBalance,
    configuration,
    initialize: open,
    observer: f.observer,
    provider: () => billing.provider,
    calls: () => calls,
    events,
    exported,
    deliveryPayloads: async () => {
      const rows = (await exportRows()).rows;
      if (provider === 'local')
        return {
          sent: rows.map(row => String(row.payload)),
          retained: (await events()).map(value => JSON.stringify(value)),
        };
      return {
        sent: reference
          ? reference.data.rawRequests
          : f.wire.data.requests
              .filter(value => value.path === '/v1/events/ingest')
              .map(value => JSON.stringify(value.body)),
        retained: rows.map(row =>
          reference ? String(row.payload) : JSON.stringify(JSON.parse(String(row.payload)).request),
        ),
      };
    },
    hostedRequests: () =>
      reference
        ? reference.data.hostedRequests.map(value => ({ operation: value.operation, body: value.body }))
        : f.wire.data.requests.filter(value => ['/v1/checkouts/', '/v1/customer-sessions/'].includes(value.path)),
    history: async () =>
      Promise.all(
        ['billing_ledger', 'billing_outbox', 'credit_grants', 'commercial_meters'].map(
          async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows,
        ),
      ).then(async rows => [...rows, (await exportRows()).rows]),
    execute: (key: string) =>
      gateway().execute(f.owner.context, {
        resourceId: 'assistant',
        operation: 'generate',
        idempotencyKey: key,
        input: { prompt: 'weather' },
      }),
    restart: async () => {
      billing.close();
      accounting.close();
      billing = await open();
      accounting = await AccountingStorage.open({ url: f.database.url }, f.organizations.storage);
    },
    close: async () => {
      accounting.close();
      billing.close();
      await reference?.close();
      await f.close();
    },
  };
}

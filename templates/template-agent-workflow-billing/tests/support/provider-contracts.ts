import { BillingGateway } from '../../src/billing/runtime/gateway.js';
import { initializeBilling } from '../../src/billing/configuration/providers.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import type { UsageEvent } from '../../src/billing/contracts/core.js';
import { identityFixture } from './identity.js';

export async function providerContractFixture() {
  const f = await identityFixture();
  const configuration = {
    ...f.configuration,
    localAccounts: [
      { workspaceId: f.owner.workspaceId, meters: [{ key: 'credits', funding: 'prepaid', balance: 10 }] },
    ],
  };
  const open = (input: unknown = configuration, url = f.database.url) =>
    initializeBilling({ configuration: input, storage: { url } });
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
  return {
    account: () => billing.provider.ensureAccount({ workspaceId: f.owner.workspaceId }),
    initialBalance: 10,
    configuration,
    initialize: open,
    observer: f.observer,
    provider: () => billing.provider,
    calls: () => calls,
    events: async (): Promise<UsageEvent[]> =>
      (await f.observer.execute('SELECT payload FROM billing_outbox ORDER BY rowid')).rows.map(row =>
        JSON.parse(String(row.payload)),
      ),
    exported: async () =>
      (await f.observer.execute('SELECT payload FROM immutable_usage ORDER BY rowid')).rows.map(row => {
        const event = JSON.parse(String(row.payload)) as UsageEvent;
        return { id: event.id, units: event.units, account: event.account.externalReference };
      }),
    history: async () =>
      Promise.all(
        ['billing_ledger', 'billing_outbox', 'commercial_meters', 'immutable_usage', 'billing_remote_operations'].map(
          async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows,
        ),
      ),
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
      await f.close();
    },
  };
}

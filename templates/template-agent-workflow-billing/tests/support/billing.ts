import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client/node';
import type { ProviderAccount, UsageEvent } from '../../src/billing/contracts.js';
import { billingConfigurationSchema } from '../../src/billing/configuration.js';

export function configuration() {
  return billingConfigurationSchema.parse({
    provider: 'local',
    resources: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        measurements: [{ key: 'token-count', unit: 'tokens', enforceableBound: true }],
        policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
      },
      {
        id: 'report',
        kind: 'workflow',
        operations: ['start', 'resume', 'cancel'],
        policy: { version: 'v1', charge: { type: 'none' } },
      },
    ],
    mappings: {
      entitlements: ['access'],
      subscriptions: ['subscription'],
      meters: [
        { key: 'credits', unit: 'credits', funding: ['prepaid'] },
        { key: 'tasks', unit: 'tasks', funding: ['prepaid', 'metered'] },
        { key: 'tokens', unit: 'tokens', funding: ['prepaid', 'metered'] },
      ],
    },
    localAccounts: [
      {
        workspaceId: 'team',
        entitlements: [{ key: 'access', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z' }],
        subscriptions: [{ key: 'subscription', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z' }],
        meters: [
          { key: 'credits', funding: 'prepaid', balance: 100 },
          { key: 'tokens', funding: 'metered', balance: null },
        ],
      },
    ],
  });
}

export function usage(account: ProviderAccount, overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    id: 'event-1',
    executionId: 'execution-1',
    account,
    policyVersion: 'v1',
    meter: 'credits',
    units: 3,
    occurredAt: '2026-11-06T12:00:00Z',
    metadata: { resourceId: 'assistant', resourceKind: 'agent' },
    ...overrides,
  };
}

export async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-billing-'));
  const filename = join(directory, 'billing.db');
  return {
    directory,
    filename,
    url: pathToFileURL(filename).href,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export async function independentClient(url: string) {
  const client = createClient({ url, intMode: 'bigint', concurrency: 1 });
  await client.execute('PRAGMA foreign_keys = ON');
  return client;
}

// Reconstruct the shipped compatibility projections before removing newer
// authoritative structures. Runtime code no longer writes these legacy tables.
export async function restoreLegacyProviderProjection(client: Awaited<ReturnType<typeof independentClient>>) {
  await client.execute(
    "INSERT INTO provider_links SELECT account_id, customer_id, organization_id FROM billing_provider_links WHERE provider = 'polar' ON CONFLICT DO NOTHING",
  );
  await client.execute(
    "UPDATE billing_accounts SET effective_provider = 'polar' WHERE id IN (SELECT account_id FROM billing_provider_links WHERE provider = 'polar')",
  );
}
export async function removeWebhookMigration(client: Awaited<ReturnType<typeof independentClient>>) {
  await client.execute('DROP TRIGGER billing_inbox_terms_immutable');
  await client.execute('DROP TRIGGER billing_inbox_no_delete');
  await client.execute('ALTER TABLE billing_inbox RENAME TO billing_inbox_current');
  await client.execute(`CREATE TABLE billing_inbox (
    id TEXT PRIMARY KEY,
    digest TEXT NOT NULL,
    event_type TEXT NOT NULL,
    account_id TEXT REFERENCES billing_accounts(id),
    occurred_at TEXT NOT NULL,
    received_at INTEGER NOT NULL,
    generation INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'ignored'))
  ) STRICT`);
  await client.execute(
    "INSERT INTO billing_inbox SELECT id, digest, event_type, account_id, occurred_at, received_at, generation, status FROM billing_inbox_current WHERE provider = 'polar'",
  );
  await client.execute('DROP TABLE billing_inbox_current');
  await client.execute(
    "CREATE TRIGGER billing_inbox_terms_immutable BEFORE UPDATE OF id, digest, event_type, account_id, occurred_at, received_at, generation ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification identity is immutable'); END",
  );
  await client.execute(
    "CREATE TRIGGER billing_inbox_no_delete BEFORE DELETE ON billing_inbox BEGIN SELECT RAISE(ABORT, 'Notification history is retained'); END",
  );
  await client.execute('DELETE FROM billing_migrations WHERE version = 12');
}

// Reconstruct a prior shipped schema without discarding its financial rows.
export async function removeDriverMigration(client: Awaited<ReturnType<typeof independentClient>>) {
  await removeWebhookMigration(client);
  await restoreLegacyProviderProjection(client);
  for (const table of [
    'billing_source_owners',
    'billing_admitted_accounts',
    'billing_provider_links',
    'billing_driver_configurations',
  ])
    await client.execute(`DROP TABLE ${table}`);
  await client.execute('ALTER TABLE billing_accounts DROP COLUMN active_provider');
  await client.execute('DELETE FROM billing_migrations WHERE version = 11');
}

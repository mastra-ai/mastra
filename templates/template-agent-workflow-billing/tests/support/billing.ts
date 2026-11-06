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

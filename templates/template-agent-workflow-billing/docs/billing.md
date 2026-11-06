# Local billing components

The billing modules validate policies and persist organization accounts, commercial eligibility and immutable usage in a local libSQL file. They require no payment credentials. Initialize them separately from Mastra with `initializeBilling` from `src/billing/setup.ts`.

These components don't yet authorize callers or execute agents and workflows. Use them only from trusted server code. The Mastra scaffold has no billed execution routes. Polar mode, checkout, portal sessions and webhook verification are unavailable.

## Configure an account and meter

Install dependencies with `npm install`. Use an absolute file URL and an existing writable parent directory. For example, create `data/` before selecting `file:///absolute/path/to/data/billing.db`.

```ts
import { initializeBilling } from '../src/billing/setup.js';

const billing = await initializeBilling({
  storage: { url: 'file:///absolute/path/to/data/billing.db' },
  configuration: {
    provider: 'local',
    resources: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        policy: {
          version: 'v1',
          access: { entitlement: 'assistant-access' },
          charge: { type: 'credits', meter: 'assistant-credits', units: 3 },
        },
      },
    ],
    mappings: {
      entitlements: ['assistant-access'],
      meters: [{ key: 'assistant-credits', unit: 'credits', funding: ['prepaid'] }],
    },
    localAccounts: [
      {
        workspaceId: 'team',
        entitlements: [{ key: 'assistant-access', validFrom: '2026-01-01T00:00:00Z', validUntil: null }],
        meters: [{ key: 'assistant-credits', funding: 'prepaid', balance: 100 }],
      },
    ],
  },
});

try {
  const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
  const event = {
    id: 'usage-1',
    executionId: 'execution-1',
    account,
    policyVersion: 'v1',
    meter: 'assistant-credits',
    units: 3,
    occurredAt: '2026-11-06T12:00:00Z',
    metadata: { resourceId: 'assistant', resourceKind: 'agent' as const },
  };

  await billing.provider.reportUsage(event); // accepted
  await billing.provider.reportUsage(event); // duplicate, no second debit
  const state = await billing.provider.getState(account); // balance 97
  const reconciliation = await billing.provider.reconcile({ account, eventIds: [event.id] });
  // reconciliation.reflectedEventIds identifies usage proven reflected locally.
} finally {
  billing.close();
}
```

Only send positive billable usage after confirmed logical success. Failed, canceled and zero-charge outcomes don't produce a billable event. This primitive doesn't validate an execution outcome or policy authorization. Keep prompts, results and credentials out of usage metadata; only `resourceId` and `resourceKind` are accepted.

Local account seeds apply once, when `ensureAccount` first creates that workspace. Reopening or changing seed values doesn't reset balances or eligibility. Accounts without a seed start with no grants or meters. Entitlements and subscriptions have separate validity windows; snapshots include only currently active grants. Meter periods are persisted boundaries, with no automatic renewal or balance reset.

## Policies and accounting

Access can require an entitlement, a subscription, or both. A `none` charge supports free or subscription-only access. Fixed `credits` use prepaid credit units. `per-task` supports agents and workflows with integer task units. `usage` requires a registered measurement with matching units and a positive `maxUnits`; prepaid measurements must declare an enforceable bound. Measurement declarations describe a resource's required capabilities, and don't themselves enforce executor limits.

Every quantity must be a safe integer. Metered meters require `balance: null` and accumulate consumption without a prepaid debit. Prepaid meters reject insufficient credit. Driver mappings use logical keys; invalid keys, duplicate mappings, unsupported operations, missing capabilities and failed-charge overrides fail initialization. Parsed configuration is deeply frozen.

An event ID claims one immutable payload across all accounts. An identical retry returns `duplicate`; changed contents or account return `BillingError` with code `conflict`. Local delivery acceptance and reconciliation are separate results. Reconciliation returns only the requested event IDs proven reflected in the same account's snapshot; missing events are omitted.

Storage uses explicit write transactions with foreign-key enforcement checked on each connection. Write-ahead logging (WAL) is required so independent readers don't block usage commits. Each transaction attempt owns and closes a single-connection client; retries don't reuse a connection with a failed statement. Lock contention retries the complete aborted transaction for up to 50 attempts with 20 ms between attempts, then returns a safe retryable error. No provider or model calls run inside a transaction.

Keep the database on persistent local disk. This component supports local files; remote URLs, sync configuration and in-memory databases are rejected. Schema history, checksums and definitions are checked transactionally. Incompatible storage stops initialization without deleting data. Preserve the database when changing application versions. No destructive reset or accounting cleanup is provided.

Run `npm run test:unit` before `npm run test:integration`. The integration suite uses disposable real databases and two independent child processes, including 20 contended duplicate-event rounds and a shared-credit overspend race. Run `npm run check` for TypeScript and formatting.

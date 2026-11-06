import { afterEach, describe, expect, it } from 'vitest';
import { BillingGateway } from '../../src/billing/gateway.js';
import type { UsageEvent } from '../../src/billing/contracts.js';
import type { BoundedExecutor, ExecutorOutcome, Json } from '../../src/billing/accounting.js';
import { boundedJsonSchema } from '../../src/billing/accounting.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { LocalBillingProvider } from '../../src/billing/providers/local.js';
import { configuration, independentClient, temporaryDatabase } from '../support/billing.js';
import { accountingWorker } from '../support/accounting.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
type Charge = ReturnType<typeof configuration>['resources'][number]['policy']['charge'];
const charges: Charge[] = [
  { type: 'none' },
  { type: 'credits', meter: 'credits', units: 3 },
  { type: 'per-task', meter: 'tasks', units: 2, funding: 'prepaid' },
  { type: 'per-task', meter: 'tasks', units: 2, funding: 'metered' },
  { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 10, funding: 'prepaid' },
  { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 10, funding: 'metered' },
];
const succeeded: ExecutorOutcome = {
  status: 'succeeded',
  result: { text: 'private result' },
  measurementComplete: true,
  measurements: [
    { id: 'call-1', measure: 'token-count', units: 4 },
    { id: 'call-1', measure: 'token-count', units: 4 },
  ],
};
function executor(run: (input: Json) => Promise<ExecutorOutcome> = async () => succeeded): BoundedExecutor {
  return {
    resourceId: 'assistant',
    operation: 'generate',
    measurements: [{ key: 'token-count', maxUnits: 10 }],
    execute: run,
  };
}
async function fixture(
  charge: Charge = charges[1],
  options: {
    kind?: 'agent' | 'workflow';
    access?: 'none' | 'entitlement' | 'subscription' | 'both';
    balance?: number;
    guards?: boolean;
    run?: (input: Json) => Promise<ExecutorOutcome>;
  } = {},
) {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const directory = await OrganizationStorage.open({ url: database.url });
  const organizations = new OrganizationService(directory, { mode: 'local', provider: 'local' });
  cleanups.push(() => organizations.close());
  const alice = await organizations.provisionLocal({ profileId: 'alice', displayName: 'Alice' });
  const bob = await organizations.provisionLocal({ profileId: 'bob', displayName: 'Bob' });
  const context = await organizations.context({ credential: alice.credential! });
  const config = configuration();
  config.resources = [config.resources[0]];
  config.resources[0].kind = options.kind ?? 'agent';
  config.resources[0].operations = [options.kind === 'workflow' ? 'start' : 'generate'];
  config.resources[0].policy = {
    version: 'v1',
    charge,
    ...(options.access === 'entitlement'
      ? { access: { entitlement: 'access' } }
      : options.access === 'subscription'
        ? { access: { subscription: 'subscription' } }
        : options.access === 'both' || options.guards
          ? { access: { entitlement: 'access', subscription: 'subscription' } }
          : {}),
  };
  const funding = charge.type === 'usage' || charge.type === 'per-task' ? charge.funding : 'prepaid';
  config.localAccounts = [
    {
      workspaceId: alice.workspaceId,
      entitlements: [{ key: 'access', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z' }],
      subscriptions: [{ key: 'subscription', validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z' }],
      meters: [
        { key: 'credits', funding: 'prepaid', balance: options.balance ?? 100, periodStart: null, periodEnd: null },
        {
          key: 'tasks',
          funding,
          balance: funding === 'prepaid' ? (options.balance ?? 100) : null,
          periodStart: null,
          periodEnd: null,
        },
        {
          key: 'tokens',
          funding,
          balance: funding === 'prepaid' ? (options.balance ?? 100) : null,
          periodStart: null,
          periodEnd: null,
        },
      ],
    },
  ];
  const commercial = await LocalBillingStorage.open({ url: database.url });
  cleanups.push(() => commercial.close());
  const provider = new LocalBillingProvider(commercial, config);
  const storage = await AccountingStorage.open({ url: database.url }, directory);
  cleanups.push(() => storage.close());
  const registered = { ...executor(options.run), operation: config.resources[0].operations[0] };
  const gateway = new BillingGateway(organizations, storage, provider, config, [registered]);
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  const request = (idempotencyKey: string, input: unknown = { prompt: 'hello' }) => ({
    resourceId: 'assistant',
    operation: registered.operation,
    idempotencyKey,
    input,
  });
  return {
    database,
    directory,
    organizations,
    alice,
    bob,
    context,
    config,
    commercial,
    provider,
    storage,
    registered,
    gateway,
    observer,
    request,
  };
}
async function totals(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    ledger: (await f.observer.execute('SELECT units, outcome FROM billing_ledger ORDER BY execution_id')).rows,
    holds: (await f.observer.execute('SELECT units, active FROM billing_reservations ORDER BY execution_id')).rows,
    events: (await f.observer.execute('SELECT id, payload FROM billing_outbox ORDER BY id')).rows,
    measurements: (await f.observer.execute('SELECT id, units FROM billing_measurements ORDER BY id')).rows,
  };
}
// Trusted fixture setup preserves a coherent, previously settled local history.
// The boundary assertions below still use the public gateway and real provider.
async function seedHistory(f: Awaited<ReturnType<typeof fixture>>, count: number): Promise<UsageEvent[]> {
  const source = await f.gateway.execute(f.context, f.request('history-source'));
  const base = JSON.parse(String((await totals(f)).events[0].payload)) as UsageEvent;
  const statements: { sql: string; args: (string | number | bigint | null)[] }[] = [];
  const events: UsageEvent[] = [];
  for (let index = 0; index < count; index++) {
    const executionId = `history-${index}`;
    const event = { ...base, id: `usage:${executionId}`, executionId };
    events.push(event);
    statements.push(
      {
        sql: 'INSERT INTO billing_executions SELECT ?, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at FROM billing_executions WHERE id = ?',
        args: [executionId, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_operations SELECT actor_id, workspace_id, resource_id, operation, ?, fingerprint, ? FROM billing_operations WHERE execution_id = ?',
        args: [executionId, executionId, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_reservations SELECT ?, account_id, meter, units, active FROM billing_reservations WHERE execution_id = ?',
        args: [executionId, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_ledger SELECT ?, account_id, meter, units, outcome, occurred_at FROM billing_ledger WHERE execution_id = ?',
        args: [executionId, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_outbox (id, execution_id, payload) VALUES (?, ?, ?)',
        args: [event.id, executionId, JSON.stringify(event)],
      },
    );
  }
  await f.observer.batch(statements, 'write');
  return events;
}
async function reflectHistory(f: Awaited<ReturnType<typeof fixture>>, events: UsageEvent[]) {
  const units = events.reduce((sum, event) => sum + event.units, 0);
  const first = events[0];
  const statements: { sql: string; args: (string | number | bigint | null)[] }[] = events.map(event => ({
    sql: 'INSERT INTO immutable_usage (id, account_id, meter, execution_id, policy_version, units, occurred_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      event.id,
      event.account.id,
      event.meter,
      event.executionId,
      event.policyVersion,
      event.units,
      event.occurredAt,
      JSON.stringify(event),
    ],
  }));
  statements.push(
    {
      sql: "UPDATE commercial_meters SET balance = CASE WHEN funding = 'prepaid' THEN balance - ? ELSE NULL END, consumed = consumed + ? WHERE account_id = ? AND key = ?",
      args: [units, units, first.account.id, first.meter],
    },
    {
      sql: 'UPDATE commercial_state SET version = version + ? WHERE account_id = ?',
      args: [events.length, first.account.id],
    },
  );
  await f.observer.batch(statements, 'write');
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('transactional billing gateway', () => {
  it('policy matrix charges only successful execution and preserves policy snapshots', async () => {
    for (const kind of ['agent', 'workflow'] as const)
      for (const access of ['none', 'entitlement', 'subscription', 'both'] as const)
        for (const charge of charges)
          for (const status of ['succeeded', 'failed', 'canceled'] as const) {
            const f = await fixture(charge, { kind, access, run: async () => ({ ...succeeded, status }) });
            const result = await f.gateway.execute(f.context, f.request('matrix'));
            const units =
              status !== 'succeeded' || charge.type === 'none' ? 0 : charge.type === 'usage' ? 4 : charge.units;
            expect(result.billing).toMatchObject({
              policyVersion: 'v1',
              executionStatus: status === 'succeeded' ? 'completed' : status,
              billedUnits: units,
              deliveryStatus: units > 0 ? 'pending' : 'not_required',
            });
            const persisted = await totals(f);
            expect(persisted.ledger).toEqual([
              { units: BigInt(units), outcome: status === 'succeeded' ? 'completed' : status },
            ]);
            expect(persisted.holds).toEqual(
              charge.type === 'none'
                ? []
                : [{ units: BigInt(charge.type === 'usage' ? 10 : charge.units), active: 0n }],
            );
            expect(persisted.measurements).toEqual([{ id: 'call-1', units: 4n }]);
            expect(persisted.events).toHaveLength(units > 0 ? 1 : 0);
            if (units > 0)
              expect(JSON.parse(String(persisted.events[0].payload))).toMatchObject({
                id: persisted.events[0].id,
                executionId: result.billing.executionId,
                policyVersion: 'v1',
                units,
                metadata: { resourceId: 'assistant', resourceKind: kind },
              });
            expect(JSON.stringify(persisted.events)).not.toContain('private result');
          }
    const entered = deferred();
    const finish = deferred<ExecutorOutcome>();
    const f = await fixture(charges[1], {
      run: async () => {
        entered.resolve();
        return finish.promise;
      },
    });
    const running = f.gateway.execute(f.context, f.request('original'));
    await entered.promise;
    f.config.resources[0].policy = { version: 'v2', charge: { type: 'credits', meter: 'credits', units: 99 } };
    const edited = new BillingGateway(f.organizations, f.storage, f.provider, f.config, [f.registered]);
    const duplicate = await edited.execute(f.context, f.request('original'));
    expect(duplicate.billing).toMatchObject({
      executionStatus: 'running',
      policyVersion: 'v1',
      billedUnits: null,
      replayed: true,
    });
    finish.resolve(succeeded);
    const completed = await running;
    expect(completed.billing).toMatchObject({ policyVersion: 'v1', billedUnits: 3 });
    expect((await edited.execute(f.context, f.request('original'))).billing).toMatchObject({
      policyVersion: 'v1',
      billedUnits: 3,
      replayed: true,
    });
    const free = await fixture(charges[0]);
    free.provider.ensureAccount = async () => {
      throw new Error('Provider must be unnecessary for free work');
    };
    expect((await free.gateway.execute(free.context, free.request('free'))).billing.billedUnits).toBe(0);

    for (const mutation of ['entitlement', 'subscription', 'meter', 'period', 'unverified', 'stale'] as const) {
      const denied = await fixture(charges[1], { guards: true });
      const reconcile = denied.provider.reconcile.bind(denied.provider);
      let reads = 0;
      denied.provider.reconcile = async request => {
        reads++;
        const observed = await reconcile(request);
        if (observed.status !== 'confirmed') return observed;
        if (mutation === 'entitlement') return { ...observed, snapshot: { ...observed.snapshot, entitlements: [] } };
        if (mutation === 'subscription')
          return {
            ...observed,
            snapshot: {
              ...observed.snapshot,
              subscriptions: observed.snapshot.subscriptions.map(grant => ({
                ...grant,
                validUntil: '2021-01-01T00:00:00Z',
              })),
            },
          };
        if (mutation === 'meter') return { ...observed, snapshot: { ...observed.snapshot, meters: [] } };
        if (mutation === 'period')
          return {
            ...observed,
            snapshot: {
              ...observed.snapshot,
              meters: observed.snapshot.meters.map(meter => ({
                ...meter,
                periodStart: '2020-01-01T00:00:00Z',
                periodEnd: '2021-01-01T00:00:00Z',
              })),
            },
          };
        if (mutation === 'unverified') return { status: 'unverified', snapshot: observed.snapshot };
        await denied.observer.execute('UPDATE commercial_state SET version = version + 1');
        return observed;
      };
      await expect(denied.gateway.execute(denied.context, denied.request('denied'))).rejects.toMatchObject({
        code: mutation === 'unverified' || mutation === 'stale' ? 'state_unavailable' : 'forbidden',
      });
      expect((await totals(denied)).ledger).toEqual([]);
      expect((await denied.observer.execute('SELECT id FROM billing_executions')).rows).toEqual([]);
      expect(reads).toBe(mutation === 'stale' ? 3 : 1);
    }
    const retry = await fixture();
    const reconcile = retry.provider.reconcile.bind(retry.provider);
    let reads = 0;
    retry.provider.reconcile = async request => {
      const result = await reconcile(request);
      if (++reads === 1) await retry.observer.execute('UPDATE commercial_state SET version = version + 1');
      return result;
    };
    expect((await retry.gateway.execute(retry.context, retry.request('fresh'))).billing.billedUnits).toBe(3);
    expect(reads).toBe(2);

    for (const observation of [
      {
        measurementComplete: true,
        measurements: [{ id: 'zero', measure: 'token-count', units: 0 }],
        status: 'succeeded',
        executionStatus: 'completed',
        billed: 0,
        settlement: 'settled',
        active: 0n,
        observed: 0,
      },
      {
        measurementComplete: false,
        measurements: [],
        status: 'succeeded',
        executionStatus: 'completed',
        billed: null,
        settlement: 'pending',
        active: 1n,
        observed: null,
      },
      {
        measurementComplete: false,
        measurements: [{ id: 'partial', measure: 'token-count', units: 2 }],
        status: 'succeeded',
        executionStatus: 'completed',
        billed: null,
        settlement: 'pending',
        active: 1n,
        observed: 2,
      },
      {
        measurementComplete: true,
        measurements: [{ id: 'overflow', measure: 'token-count', units: 11 }],
        status: 'succeeded',
        executionStatus: 'failed',
        billed: 0,
        settlement: 'released',
        active: 0n,
        observed: 11,
      },
      {
        measurementComplete: true,
        measurements: [{ id: 'overflow', measure: 'token-count', units: 11 }],
        status: 'uncertain',
        executionStatus: 'uncertain',
        billed: null,
        settlement: 'uncertain',
        active: 1n,
        observed: 11,
      },
    ] as const) {
      const usage = await fixture(charges[4], {
        run: async () => ({
          ...succeeded,
          status: observation.status,
          measurementComplete: observation.measurementComplete,
          measurements: [...observation.measurements],
        }),
      });
      const response = await usage.gateway.execute(usage.context, usage.request('measurement'));
      expect(response.billing).toMatchObject({
        executionStatus: observation.executionStatus,
        settlementStatus: observation.settlement,
        billedUnits: observation.billed,
        observedUnits: observation.observed,
      });
      const persisted = await totals(usage);
      expect(persisted.holds[0].active).toBe(observation.active);
      expect(persisted.events).toEqual([]);
      expect(persisted.ledger).toHaveLength(observation.billed === null ? 0 : 1);
    }
    const invalid = await fixture(charges[4]);
    expect(
      () =>
        new BillingGateway(invalid.organizations, invalid.storage, invalid.provider, invalid.config, [
          { ...invalid.registered, measurements: [] },
        ]),
    ).toThrow(expect.objectContaining({ code: 'invalid_configuration' }));
    await expect(
      invalid.gateway.execute(invalid.context, {
        ...invalid.request('override'),
        policy: { charge: { type: 'none' } },
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      invalid.gateway.execute(invalid.context, { ...invalid.request('lifecycle'), operation: 'cancel' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    const cycle: any = {};
    cycle.self = cycle;
    let invoked = false;
    for (const bad of [
      cycle,
      Infinity,
      new Date(),
      {
        get secret() {
          invoked = true;
          return 'secret';
        },
      },
      'x'.repeat(16385),
    ])
      expect(boundedJsonSchema.safeParse(bad).success).toBe(false);
    expect(invoked).toBe(false);
  }, 60_000);

  it('concurrent members cannot overspend shared credit', async () => {
    // Separate processes use independently opened SQL connections. A parent SQL
    // write lock forces both through actual lock contention in every round.
    const f = await fixture(charges[1], { balance: 60 });
    await f.organizations.convert(f.context, 'share');
    const invite = await f.organizations.invite(f.context, 'invite', {
      recipientId: f.bob.identity.id,
      role: 'member',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    await f.organizations.acceptInvitation({ credential: f.bob.credential!, key: 'join', token: invite.token! });
    const account = await f.provider.ensureAccount({ workspaceId: f.alice.workspaceId });
    const workers = [
      accountingWorker(f.database.url, f.config, f.alice.credential!, f.alice.workspaceId),
      accountingWorker(f.database.url, f.config, f.bob.credential!, f.alice.workspaceId),
    ];
    cleanups.push(...workers.map(worker => worker.close));
    await Promise.all(workers.map(worker => worker.wait('ready')));
    for (let round = 0; round < 20; round++) {
      // Only three confirmed units remain available to new work in this round:
      // previous settled debits remain unreflected and must retain their holds.
      await f.observer.execute({
        sql: "UPDATE commercial_meters SET balance = ? WHERE account_id = ? AND key = 'credits'",
        args: [(round + 1) * 3, account.id],
      });
      const barrier = await f.observer.transaction('write');
      try {
        workers.forEach((worker, index) => worker.send({ type: 'execute', round, key: `round-${round}-${index}` }));
        const attempts = await Promise.all(workers.map(worker => worker.wait('attempting', round)));
        expect(attempts.map(attempt => attempt.contended)).toEqual([true, true]);
        await barrier.commit();
      } finally {
        barrier.close();
      }
      const results = await Promise.all(workers.map(worker => worker.wait('result', round)));
      expect(results.map(result => result.status).sort()).toEqual(['completed', 'insufficient_credits']);
      expect(
        (await f.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
      ).toEqual([{ count: BigInt(round + 1), units: BigInt((round + 1) * 3) }]);
    }
    const persisted = await totals(f);
    expect(persisted.events).toHaveLength(20);
    expect(persisted.holds.every(hold => hold.active === 0n)).toBe(true);
    // Local provider delivery reduces the confirmed balance. Its exact payload
    // reflection removes the old debit hold, without subtracting the debit twice.
    await f.observer.execute({
      sql: "UPDATE commercial_meters SET balance = 63 WHERE account_id = ? AND key = 'credits'",
      args: [account.id],
    });
    for (const event of persisted.events)
      expect((await f.provider.reportUsage(JSON.parse(String(event.payload)))).status).toBe('accepted');
    expect((await f.provider.getState(account)).meters.find(meter => meter.key === 'credits')?.confirmedBalance).toBe(
      3,
    );
    expect((await f.gateway.execute(f.context, f.request('after-reflection'))).billing.billedUnits).toBe(3);
    await expect(f.gateway.execute(f.context, f.request('exhausted'))).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    expect((await totals(f)).events).toHaveLength(21);
    const history = await fixture(charges[1], { balance: 3009 });
    const oldEvents = await seedHistory(history, 1000);
    // There are 1,001 pending debits. A bounded provider request must not become
    // a lifetime or pending-count cutoff on otherwise affordable work.
    expect(
      (await history.gateway.execute(history.context, history.request('after-pending-history'))).billing.billedUnits,
    ).toBe(3);
    await reflectHistory(history, oldEvents);
    // These 1,000 exact payloads are reflected in this versioned SQL balance,
    // even though none must appear in the next bounded reconciliation response.
    expect(
      (await history.gateway.execute(history.context, history.request('after-reflected-history'))).billing.billedUnits,
    ).toBe(3);
    await expect(history.gateway.execute(history.context, history.request('history-exhausted'))).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    expect(
      (await history.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
    ).toEqual([{ count: 1003n, units: 3009n }]);
    const mismatch = await fixture(charges[1], { balance: 6 });
    await mismatch.gateway.execute(mismatch.context, mismatch.request('mismatch-source'));
    const mismatchedEvent = JSON.parse(String((await totals(mismatch)).events[0].payload)) as UsageEvent;
    expect((await mismatch.provider.reportUsage({ ...mismatchedEvent, units: 1 })).status).toBe('accepted');
    // An event ID alone cannot release a settled debit when its exact immutable
    // provider payload differs from the billable event still in the outbox.
    await expect(mismatch.gateway.execute(mismatch.context, mismatch.request('mismatch-held'))).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    expect((await totals(mismatch)).ledger).toEqual([{ units: 3n, outcome: 'completed' }]);

    const metered = await fixture(charges[3]);
    await seedHistory(metered, 1000);
    expect(
      (await metered.gateway.execute(metered.context, metered.request('metered-after-pending-history'))).billing,
    ).toMatchObject({ executionStatus: 'completed', billedUnits: 2 });
    expect(
      (await metered.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
    ).toEqual([{ count: 1002n, units: 2004n }]);
  }, 60_000);

  it('idempotency binds input identity and outcome without duplicate charges', async () => {
    let arrayCalls = 0;
    const arrays = await fixture(charges[1], {
      run: async input => {
        arrayCalls++;
        return { status: 'succeeded', result: { received: input } };
      },
    });
    const malformedArrays = [
      ...['4294967295', '4294967296'].flatMap(key =>
        ['first', 'second'].map(value => Object.assign(new Array(1), { [key]: value })),
      ),
      new Array(1),
      Object.assign(new Array(2), { 1: 'last' }),
      Object.assign(['first'], { extra: 'hidden' }),
      Object.assign(['first'], { '4294967295': 'hidden' }),
      Object.assign(['first'], { '4294967296': 'hidden' }),
    ];
    for (const [index, input] of malformedArrays.entries()) {
      await expect(
        arrays.gateway.execute(arrays.context, arrays.request(`malformed-array-${index}`, input)),
      ).rejects.toMatchObject({ code: 'invalid_input' });
      expect(arrayCalls).toBe(0);
      expect((await arrays.observer.execute('SELECT COUNT(*) AS count FROM billing_operations')).rows).toEqual([
        { count: 0n },
      ]);
      expect((await arrays.observer.execute('SELECT COUNT(*) AS count FROM billing_executions')).rows).toEqual([
        { count: 0n },
      ]);
    }
    const dense = await arrays.gateway.execute(
      arrays.context,
      arrays.request('dense-array', ['first', { a: 1, b: 2 }, ['nested', 0]]),
    );
    expect(dense.result).toEqual({ received: ['first', { a: 1, b: 2 }, ['nested', 0]] });
    expect(
      (
        await arrays.gateway.execute(
          arrays.context,
          arrays.request('dense-array', ['first', { b: 2, a: 1 }, ['nested', -0]]),
        )
      ).billing,
    ).toMatchObject({ executionId: dense.billing.executionId, replayed: true, billedUnits: 3 });
    await expect(
      arrays.gateway.execute(arrays.context, arrays.request('dense-array', ['second', { a: 1, b: 2 }, ['nested', 0]])),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(arrayCalls).toBe(1);
    expect((await arrays.observer.execute('SELECT COUNT(*) AS count FROM billing_operations')).rows).toEqual([
      { count: 1n },
    ]);
    expect((await totals(arrays)).ledger).toEqual([{ units: 3n, outcome: 'completed' }]);

    let calls = 0;
    const f = await fixture(charges[1], {
      run: async () => {
        calls++;
        return succeeded;
      },
    });
    const first = await f.gateway.execute(f.context, f.request('same', { b: 2, a: { y: 1, x: 0 } }));
    const replay = await f.gateway.execute(f.context, f.request('same', { a: { x: -0, y: 1 }, b: 2 }));
    expect(replay).toEqual({ ...first, billing: { ...first.billing, replayed: true } });
    expect(calls).toBe(1);
    await expect(f.gateway.execute(f.context, f.request('same', { b: 3, a: { x: 0, y: 1 } }))).rejects.toMatchObject({
      code: 'conflict',
    });
    const event = (await totals(f)).events[0];
    const noResources = { ...f.config, resources: [] };
    const edited = new BillingGateway(f.organizations, f.storage, f.provider, noResources, []);
    expect((await edited.execute(f.context, f.request('same', { b: 2, a: { y: 1, x: 0 } }))).billing).toMatchObject({
      executionId: first.billing.executionId,
      policyVersion: 'v1',
      billedUnits: 3,
      replayed: true,
    });
    await f.organizations.convert(f.context, 'share');
    const invitation = await f.organizations.invite(f.context, 'invite', {
      recipientId: f.bob.identity.id,
      role: 'member',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    await f.organizations.acceptInvitation({ credential: f.bob.credential!, key: 'join', token: invitation.token! });
    const member = await f.organizations.context({ credential: f.bob.credential!, workspaceId: f.alice.workspaceId });
    await expect(f.gateway.read(member, first.billing.executionId)).rejects.toMatchObject({ code: 'forbidden' });
    const other = await f.gateway.execute(member, f.request('same', { b: 2, a: { y: 1, x: 0 } }));
    expect(other.billing.executionId).not.toBe(first.billing.executionId);
    expect(calls).toBe(2);
    await f.organizations.changeMember(f.context, 'remove', { memberId: f.bob.identity.id, role: null });
    await expect(f.gateway.execute(member, f.request('same', { b: 2, a: { y: 1, x: 0 } }))).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect((await totals(f)).events.find(row => row.id === event.id)).toEqual(event);

    // Credential revocation during the provider await must win final admission.
    const revoked = await fixture();
    const reconcile = revoked.provider.reconcile.bind(revoked.provider);
    revoked.provider.reconcile = async request => {
      const result = await reconcile(request);
      await revoked.directory.revokeCredential(revoked.alice.credential!);
      return result;
    };
    await expect(revoked.gateway.execute(revoked.context, revoked.request('revoked'))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect((await revoked.observer.execute('SELECT id FROM billing_executions')).rows).toEqual([]);

    const throwing = await fixture(charges[1], {
      run: async () => {
        throw new Error('private provider details');
      },
    });
    const uncertain = await throwing.gateway.execute(throwing.context, throwing.request('unknown'));
    expect(uncertain).toMatchObject({
      result: null,
      billing: { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null },
    });
    expect((await totals(throwing)).holds).toEqual([{ units: 3n, active: 1n }]);
    expect((await totals(throwing)).ledger).toEqual([]);
    expect((await throwing.gateway.execute(throwing.context, throwing.request('unknown'))).billing).toMatchObject({
      executionId: uncertain.billing.executionId,
      replayed: true,
    });

    // A real SQL trigger fails after terminal state/ledger writes, at outbox
    // insertion. The whole settlement rolls back and cannot dispatch work again.
    const rollback = await fixture();
    await rollback.observer.execute(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON billing_outbox BEGIN SELECT RAISE(ABORT, 'Injected outbox failure'); END",
    );
    await expect(rollback.gateway.execute(rollback.context, rollback.request('rollback'))).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(await totals(rollback)).toMatchObject({
      ledger: [],
      events: [],
      holds: [{ units: 3n, active: 1n }],
      measurements: [],
    });
    const pending = await rollback.gateway.execute(rollback.context, rollback.request('rollback'));
    expect(pending.billing).toMatchObject({ executionStatus: 'running', billedUnits: null, replayed: true });
    await rollback.observer.execute('DROP TRIGGER fail_outbox');

    // A terminated process leaves a durable claim. A new runtime reports the
    // ambiguous execution and retains the hold instead of executing it again.
    const crashed = await fixture();
    const worker = accountingWorker(
      crashed.database.url,
      crashed.config,
      crashed.alice.credential!,
      crashed.alice.workspaceId,
    );
    cleanups.push(worker.close);
    await worker.wait('ready');
    worker.send({ type: 'hang', round: 0, key: 'crashed' });
    await worker.wait('executing', 0);
    await worker.close();
    const recovered = await crashed.gateway.execute(crashed.context, crashed.request('crashed'));
    expect(recovered.billing).toMatchObject({
      executionStatus: 'uncertain',
      settlementStatus: 'uncertain',
      billedUnits: null,
      replayed: true,
    });
    expect((await totals(crashed)).holds).toEqual([{ units: 3n, active: 1n }]);
    expect((await totals(crashed)).ledger).toEqual([]);
    // Two independent repositories race terminal claims for the same durable
    // uncertain execution. Confirmed success/cancel must publish one outcome.
    const terminal = await fixture(charges[1], { run: async () => ({ status: 'uncertain' }) });
    const competitor = await AccountingStorage.open({ url: terminal.database.url }, terminal.directory);
    cleanups.push(() => competitor.close());
    let charged = 0;
    for (let round = 0; round < 20; round++) {
      const claim = await terminal.gateway.execute(terminal.context, terminal.request(`terminal-${round}`));
      const barrier = await terminal.observer.transaction('write');
      let outcomes;
      try {
        const success = () => terminal.storage.finish(claim.billing.executionId, succeeded, { text: 'success' });
        const cancel = () =>
          competitor.finish(
            claim.billing.executionId,
            { status: 'canceled', measurementComplete: true, measurements: [] },
            null,
          );
        const attempts = round % 2 === 0 ? [success(), cancel()] : [cancel(), success()];
        await barrier.commit();
        outcomes = await Promise.all(attempts);
      } finally {
        barrier.close();
      }
      expect(outcomes[0].billing).toEqual(outcomes[1].billing);
      expect(['completed', 'canceled']).toContain(outcomes[0].billing.executionStatus);
      const billed = outcomes[0].billing.executionStatus === 'completed' ? 3 : 0;
      charged += billed;
      expect((await terminal.gateway.read(terminal.context, claim.billing.executionId)).billing).toMatchObject({
        executionStatus: outcomes[0].billing.executionStatus,
        billedUnits: billed,
      });
      expect(
        (
          await terminal.observer.execute({
            sql: 'SELECT units, outcome FROM billing_ledger WHERE execution_id = ?',
            args: [claim.billing.executionId],
          })
        ).rows,
      ).toEqual([{ units: BigInt(billed), outcome: outcomes[0].billing.executionStatus }]);
    }
    expect(
      (await terminal.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
    ).toEqual([{ count: 20n, units: BigInt(charged) }]);
    expect((await totals(terminal)).events).toHaveLength(charged / 3);
    expect((await totals(terminal)).holds.every(hold => hold.active === 0n)).toBe(true);

    const originalPayload = JSON.parse(String(event.payload));
    expect((await f.provider.reportUsage(originalPayload)).status).toBe('accepted');
    expect((await f.provider.reportUsage(originalPayload)).status).toBe('duplicate');
    expect((await totals(f)).events.find(row => row.id === event.id)).toEqual(event);
    await expect(f.observer.execute('UPDATE billing_ledger SET units = 99')).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
    await expect(f.observer.execute('DELETE FROM billing_operations')).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
  }, 60_000);
});

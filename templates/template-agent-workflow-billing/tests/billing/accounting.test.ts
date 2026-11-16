import { removeUnreflectedMigration } from '../support/billing.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentExecutionInputSchema } from '../../src/billing/runtime/agent-execution.js';
import { BillingGateway } from '../../src/billing/runtime/gateway.js';
import type { UsageEvent } from '../../src/billing/contracts/core.js';
import type { BoundedExecutor, ExecutorOutcome, Json } from '../../src/billing/runtime/accounting.js';
import { boundedJsonSchema } from '../../src/billing/runtime/accounting.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
import { LocalBillingProvider } from '../../src/billing/providers/local/index.js';
import { configuration, independentClient, temporaryDatabase } from '../support/billing.js';
import { accountingWorker } from '../support/accounting.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
it('another runtime replays active work without changing the owner execution', async () => {
  const f = await fixture();
  const worker = accountingWorker(f.database.url, f.config, f.alice.credential!, f.alice.workspaceId);
  cleanups.push(worker.close);
  await worker.wait('ready');
  worker.send({ type: 'hang', round: 0, key: 'live-owner' });
  await worker.wait('executing', 0);
  const before = (await f.observer.execute('SELECT id, status, settlement FROM billing_executions')).rows;
  expect((await f.gateway.execute(f.context, f.request('live-owner'))).billing).toMatchObject({
    executionStatus: 'running',
    replayed: true,
    billedUnits: null,
  });
  expect((await f.observer.execute('SELECT id, status, settlement FROM billing_executions')).rows).toEqual(before);
});

it.each(['weather-credits', 'image-credits'])(
  'denied %s reservations do not block migration of remaining credits',
  async source => {
    const f = await fixture({ type: 'credits', meter: source, units: 20 }, { balance: 10, creditMeter: source });
    await expect(f.gateway.execute(f.context, f.request('denied-migration'))).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    expect(
      (await f.observer.execute('SELECT reserve_state, terminal_state FROM billing_remote_operations')).rows,
    ).toEqual([{ reserve_state: 'denied', terminal_state: 'pending' }]);
    const current = configuration();
    current.localAccounts = [{ ...current.localAccounts[0], workspaceId: f.alice.workspaceId }];
    const provider = new LocalBillingProvider(f.commercial, current);
    const account = await provider.ensureAccount({ workspaceId: f.alice.workspaceId });
    expect((await provider.getState(account)).meters.find(meter => meter.key === 'credits')).toMatchObject({
      confirmedBalance: 10,
      consumedUnits: 0,
    });
  },
);

it('agent payload validation rejects malformed requests before reserving credit', async () => {
  let computes = 0;
  const f = await fixture(charges[1], {
    run: async () => {
      computes++;
      return succeeded;
    },
  });
  const gateway = new BillingGateway(f.organizations, f.storage, f.provider, f.config, [
    { ...f.registered, inputSchema: agentExecutionInputSchema },
  ]);
  for (const input of [
    { prompt: '', adapterVersion: 'v1' },
    { prompt: 'x'.repeat(8193), adapterVersion: 'v1' },
    { prompt: 'hello', adapterVersion: 'invalid version' },
  ]) {
    await expect(gateway.execute(f.context, f.request('invalid-payload', input))).rejects.toMatchObject({
      code: 'invalid_input',
    });
  }
  expect(computes).toBe(0);
  expect((await f.observer.execute('SELECT id FROM billing_executions')).rows).toEqual([]);
  expect(
    (await gateway.execute(f.context, f.request('invalid-payload', { prompt: 'hello', adapterVersion: 'v1' }))).billing
      .billedUnits,
  ).toBe(3);
  expect(computes).toBe(1);
});

type Charge = ReturnType<typeof configuration>['resourcePolicies'][number]['policy']['charge'];
const charges: Charge[] = [
  { type: 'none' },
  { type: 'credits', meter: 'credits', units: 3 },
  { type: 'per-task', meter: 'tasks', units: 2, funding: 'prepaid' },
  { type: 'per-task', meter: 'tasks', units: 2, funding: 'metered' },
  { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 10, funding: 'prepaid' },
  { type: 'usage', meter: 'tokens', measure: 'token-count', maxUnits: 10, funding: 'metered' },
];
const exportOnSuccess = [false, false, false, true, false, true] as const;
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
    creditMeter?: string;
    guards?: boolean;
    run?: (input: Json) => Promise<ExecutorOutcome>;
  } = {},
) {
  const fixtureCleanups: (() => void | Promise<void>)[] = [];
  const dispose = async () => {
    for (const cleanup of fixtureCleanups.splice(0).reverse()) await cleanup();
  };
  cleanups.push(dispose);
  const database = await temporaryDatabase();
  fixtureCleanups.push(database.cleanup);
  const directory = await OrganizationStorage.open({ url: database.url });
  const organizations = new OrganizationService(directory, { mode: 'local', provider: 'local' });
  fixtureCleanups.push(() => organizations.close());
  const alice = await organizations.provisionLocal({ profileId: 'alice', displayName: 'Alice' });
  const bob = await organizations.provisionLocal({ profileId: 'bob', displayName: 'Bob' });
  const context = await organizations.context({ credential: alice.credential! });
  const config = configuration();
  if (options.creditMeter) config.billingKeys.meters[0].key = options.creditMeter;
  config.resourcePolicies = [config.resourcePolicies[0]];
  config.resourcePolicies[0].kind = options.kind ?? 'agent';
  config.resourcePolicies[0].operations = [options.kind === 'workflow' ? 'start' : 'generate'];
  config.resourcePolicies[0].policy = {
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
        {
          key: options.creditMeter ?? 'credits',
          funding: 'prepaid',
          balance: options.balance ?? 100,
          periodStart: null,
          periodEnd: null,
        },
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
  fixtureCleanups.push(() => commercial.close());
  const provider = new LocalBillingProvider(commercial, config);
  const storage = await AccountingStorage.open({ url: database.url }, directory);
  fixtureCleanups.push(() => storage.close());
  const registered = { ...executor(options.run), operation: config.resourcePolicies[0].operations[0] };
  const gateway = new BillingGateway(organizations, storage, provider, config, [registered]);
  const observer = await independentClient(database.url);
  fixtureCleanups.push(() => observer.close());
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
    dispose,
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
        sql: 'INSERT INTO billing_executions (id, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at) SELECT ?, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at FROM billing_executions WHERE id = ?',
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

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('transactional billing gateway', () => {
  it('local free subscription task and usage policies preserve provider contract', async () => {
    for (const kind of ['agent', 'workflow'] as const)
      for (const access of ['none', 'entitlement', 'subscription', 'both'] as const)
        for (const [chargeIndex, charge] of charges.entries())
          for (const status of ['succeeded', 'failed', 'canceled'] as const) {
            const f = await fixture(charge, { kind, access, run: async () => ({ ...succeeded, status }) });
            try {
              const result = await f.gateway.execute(f.context, f.request('matrix'));
              const units =
                status !== 'succeeded' || charge.type === 'none' ? 0 : charge.type === 'usage' ? 4 : charge.units;
              expect(result.billing).toMatchObject({
                policyVersion: 'v1',
                executionStatus: status === 'succeeded' ? 'completed' : status,
                billedUnits: units,
                deliveryStatus: units > 0 && exportOnSuccess[chargeIndex] ? 'pending' : 'not_required',
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
              expect(persisted.events).toHaveLength(units > 0 && exportOnSuccess[chargeIndex] ? 1 : 0);
              if (units > 0 && exportOnSuccess[chargeIndex])
                expect(JSON.parse(String(persisted.events[0].payload))).toMatchObject({
                  id: persisted.events[0].id,
                  executionId: result.billing.executionId,
                  policyVersion: 'v1',
                  units,
                  metadata: { resourceId: 'assistant', resourceKind: kind },
                });
              expect(JSON.stringify(persisted.events)).not.toContain('private result');
            } finally {
              await f.dispose();
            }
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
    f.config.resourcePolicies[0].policy = { version: 'v2', charge: { type: 'credits', meter: 'credits', units: 99 } };
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

    for (const mutation of ['entitlement', 'subscription', 'meter', 'period', 'unverified'] as const) {
      const denied = await fixture(charges[1], { guards: true });
      const readState = denied.provider.getState.bind(denied.provider);
      denied.provider.getState = async account => {
        const observed = await readState(account);
        if (mutation === 'entitlement') return { ...observed, entitlements: [] };
        if (mutation === 'subscription') return { ...observed, subscriptions: [] };
        if (mutation === 'meter') return { ...observed, meters: [] };
        if (mutation === 'period')
          return {
            ...observed,
            meters: observed.meters.map(meter => ({
              ...meter,
              periodStart: '2020-01-01T00:00:00Z',
              periodEnd: '2021-01-01T00:00:00Z',
            })),
          };
        return { ...observed, evidence: null };
      };
      if (mutation === 'unverified')
        expect((await denied.gateway.execute(denied.context, denied.request('denied'))).billing).toMatchObject({
          executionStatus: 'uncertain',
          billedUnits: null,
        });
      else
        await expect(denied.gateway.execute(denied.context, denied.request('denied'))).rejects.toMatchObject({
          code: 'forbidden',
        });
      expect((await totals(denied)).ledger).toEqual([]);
      expect((await denied.observer.execute('SELECT id FROM local_provider_reservations')).rows).toEqual([]);
    }

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
        executionStatus: 'uncertain',
        billed: null,
        settlement: 'pending',
        active: 1n,
        observed: null,
      },
      {
        measurementComplete: false,
        measurements: [{ id: 'partial', measure: 'token-count', units: 2 }],
        status: 'succeeded',
        executionStatus: 'uncertain',
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
        args: [3, account.id],
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
    expect(persisted.events).toEqual([]);
    expect(persisted.holds.every(hold => hold.active === 0n)).toBe(true);
    expect((await f.provider.getState(account)).meters.find(meter => meter.key === 'credits')?.confirmedBalance).toBe(
      0,
    );
    await f.observer.execute({
      sql: "UPDATE commercial_meters SET balance = 3 WHERE account_id = ? AND key = 'credits'",
      args: [account.id],
    });
    expect((await f.gateway.execute(f.context, f.request('after-confirmation'))).billing.billedUnits).toBe(3);
    await expect(f.gateway.execute(f.context, f.request('exhausted'))).rejects.toMatchObject({
      code: 'insufficient_credits',
    });
    expect((await totals(f)).events).toEqual([]);
    // Reflected-prepaid-export cases are superseded by provider reservation
    // authority. Bounded postpaid history retains the generic outbox contract.
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
    const ledger = (await totals(f)).ledger;
    const noResources = { ...f.config, resourcePolicies: [] };
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
    expect((await totals(f)).ledger).toEqual([...ledger, { units: 3n, outcome: 'completed' }]);

    // Credential revocation during the provider await must win final admission.
    const revoked = await fixture();
    const getState = revoked.provider.getState.bind(revoked.provider);
    revoked.provider.getState = async request => {
      const result = await getState(request);
      await revoked.directory.revokeCredential(revoked.alice.credential!);
      return result;
    };
    await expect(revoked.gateway.execute(revoked.context, revoked.request('revoked'))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect((await revoked.observer.execute('SELECT status, billed_units FROM billing_executions')).rows).toEqual([
      { status: 'uncertain', billed_units: null },
    ]);
    expect((await revoked.observer.execute('SELECT id FROM local_provider_reservations')).rows).toEqual([]);

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
    const rollback = await fixture(charges[3]);
    await rollback.observer.execute(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON billing_outbox BEGIN SELECT RAISE(ABORT, 'Injected outbox failure'); END",
    );
    await expect(rollback.gateway.execute(rollback.context, rollback.request('rollback'))).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect(await totals(rollback)).toMatchObject({
      ledger: [],
      events: [],
      holds: [{ units: 2n, active: 1n }],
      measurements: [],
    });
    const pending = await rollback.gateway.execute(rollback.context, rollback.request('rollback'));
    expect(pending.billing).toMatchObject({ executionStatus: 'running', billedUnits: null, replayed: true });
    await rollback.observer.execute('DROP TRIGGER fail_outbox');

    // Replay retains the durable claim even after termination. Only explicit
    // liveness-based recovery can fence the owner and mark it uncertain.
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
      executionStatus: 'running',
      settlementStatus: 'reserved',
      billedUnits: null,
      replayed: true,
    });
    expect((await totals(crashed)).holds).toEqual([{ units: 3n, active: 1n }]);
    expect((await totals(crashed)).ledger).toEqual([]);
    // Two independent repositories race terminal claims for the same durable
    // uncertain execution. Confirmed success/cancel must publish one outcome.
    const terminal = await fixture(charges[1], { run: async () => ({ status: 'uncertain' }) });
    const competitor = await AccountingStorage.open({ url: terminal.database.url }, terminal.directory);
    competitor.useReservations(terminal.provider);
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
      expect(outcomes[0].billing.executionId).toBe(outcomes[1].billing.executionId);
      expect(outcomes[0].billing.executionStatus).toBe(outcomes[1].billing.executionStatus);
      const settled = await terminal.gateway.read(terminal.context, claim.billing.executionId);
      expect(settled.billing.billedUnits).toBe(outcomes[0].billing.executionStatus === 'completed' ? 3 : 0);
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
    expect((await totals(terminal)).events).toEqual([]);
    expect((await totals(terminal)).holds.every(hold => hold.active === 0n)).toBe(true);

    expect((await totals(f)).events).toEqual([]);
    expect((await totals(f)).ledger).toEqual([...ledger, { units: 3n, outcome: 'completed' }]);
    await expect(f.observer.execute('UPDATE billing_ledger SET units = 99')).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
    await expect(f.observer.execute('DELETE FROM billing_operations')).rejects.toMatchObject({
      extendedCode: 'SQLITE_CONSTRAINT_TRIGGER',
    });
  }, 60_000);
  it('restart releases undispatched completed work after its confirmation cutoff without recompute', async () => {
    let computes = 0;
    const f = await fixture(charges[1], {
      run: async () => {
        computes++;
        return succeeded;
      },
    });
    // A real SQL fault simulates losing the process between result persistence
    // and the financial dispatch claim. Nothing reaches the provider finalize.
    await f.observer.execute(
      "CREATE TRIGGER fail_financial_dispatch BEFORE UPDATE OF terminal_dispatched ON billing_remote_operations WHEN OLD.terminal_dispatched = 0 AND NEW.terminal_dispatched = 1 BEGIN SELECT RAISE(ABORT, 'Injected dispatch claim failure'); END",
    );
    await expect(f.gateway.execute(f.context, f.request('dispatch-crash'))).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    const pending = await f.gateway.execute(f.context, f.request('dispatch-crash'));
    expect(pending).toMatchObject({
      result: { text: 'private result' },
      billing: { executionStatus: 'completed', settlementStatus: 'pending', billedUnits: null, replayed: true },
    });
    const row = (await f.observer.execute('SELECT request FROM billing_remote_operations')).rows[0];
    const request = JSON.parse(String(row.request));
    const before = (await f.observer.execute('SELECT result FROM billing_executions')).rows[0].result;
    expect((await f.observer.execute('SELECT state, terminal_payload FROM local_provider_reservations')).rows).toEqual([
      { state: 'reserved', terminal_payload: null },
    ]);
    await f.observer.execute('DROP TRIGGER fail_financial_dispatch');
    f.storage.close();
    const restarted = await AccountingStorage.open({ url: f.database.url }, f.directory);
    cleanups.push(() => restarted.close());
    const gateway = new BillingGateway(f.organizations, restarted, f.provider, f.config, [f.registered]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(request.confirmationCutoff + 1);
    try {
      await restarted.recoverFinancial();
      const replay = await gateway.execute(f.context, f.request('dispatch-crash'));
      expect(replay).toMatchObject({
        result: { text: 'private result' },
        billing: { executionStatus: 'failed', settlementStatus: 'released', billedUnits: 0, replayed: true },
      });
      expect(computes).toBe(1);
      expect((await f.observer.execute('SELECT result FROM billing_executions')).rows[0].result).toBe(before);
      expect((await f.observer.execute('SELECT units, outcome FROM billing_ledger')).rows).toEqual([
        { units: 0n, outcome: 'failed' },
      ]);
      expect((await f.observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
      const effect = (await f.observer.execute('SELECT state, terminal_payload FROM local_provider_reservations'))
        .rows[0];
      expect(effect.state).toBe('released');
      expect(JSON.parse(String(effect.terminal_payload))).toMatchObject({ action: 'release', units: 0 });
      const account = await f.provider.ensureAccount({ workspaceId: f.alice.workspaceId });
      expect((await f.provider.getState(account)).meters.find(meter => meter.key === 'credits')).toMatchObject({
        confirmedBalance: 100,
        consumedUnits: 0,
      });
    } finally {
      clock.mockRestore();
    }
  });

  it('restart keeps a dispatched unknown confirmation immutable beyond its cutoff', async () => {
    let computes = 0;
    const f = await fixture(charges[1], {
      run: async () => {
        computes++;
        return succeeded;
      },
    });
    // The provider commits the debit, then the local acknowledgement transaction
    // fails. Restart must reconcile that confirm and never send a release.
    await f.observer.execute(
      "CREATE TRIGGER fail_financial_ack BEFORE UPDATE OF terminal_state ON billing_remote_operations WHEN NEW.terminal_state = 'confirmed' BEGIN SELECT RAISE(ABORT, 'Injected acknowledgement persistence failure'); END",
    );
    await expect(f.gateway.execute(f.context, f.request('lost-confirm-ack'))).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    expect((await f.gateway.execute(f.context, f.request('lost-confirm-ack'))).billing).toMatchObject({
      settlementStatus: 'pending',
      billedUnits: null,
    });
    const row = (
      await f.observer.execute(
        'SELECT request, terminal_request, terminal_payload, terminal_dispatched FROM billing_remote_operations',
      )
    ).rows[0];
    expect(row.terminal_dispatched).toBe(1n);
    expect(JSON.parse(String(row.terminal_request))).toMatchObject({ action: 'confirm', units: 3 });
    await f.observer.execute('DROP TRIGGER fail_financial_ack');
    f.storage.close();
    const restarted = await AccountingStorage.open({ url: f.database.url }, f.directory);
    cleanups.push(() => restarted.close());
    const gateway = new BillingGateway(f.organizations, restarted, f.provider, f.config, [f.registered]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(JSON.parse(String(row.request)).expiresAt + 1);
    try {
      await restarted.recoverFinancial();
      const replay = await gateway.execute(f.context, f.request('lost-confirm-ack'));
      expect(replay.billing).toMatchObject({
        executionStatus: 'completed',
        settlementStatus: 'settled',
        billedUnits: 3,
        replayed: true,
      });
      expect(computes).toBe(1);
      expect(
        (await f.observer.execute('SELECT terminal_payload FROM billing_remote_operations')).rows[0].terminal_payload,
      ).toBe(row.terminal_payload);
      const effect = (await f.observer.execute('SELECT state, terminal_payload FROM local_provider_reservations'))
        .rows[0];
      expect(effect.state).toBe('confirmed');
      expect(JSON.parse(String(effect.terminal_payload))).toMatchObject({ action: 'confirm', units: 3 });
      expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
      expect((await f.observer.execute('SELECT id FROM billing_outbox')).rows).toEqual([]);
    } finally {
      clock.mockRestore();
    }
  });
});

it('late measurements complete an incomplete usage execution exactly once', async () => {
  for (const charge of [charges[4], charges[5]]) {
    const f = await fixture(charge, {
      run: async () => ({ ...succeeded, measurementComplete: false, measurements: [] }),
    });
    const first = await f.gateway.execute(f.context, f.request('late-measurement'));
    expect(first.billing).toMatchObject({
      executionStatus: 'uncertain',
      billedUnits: null,
      settlementStatus: 'pending',
    });
    await f.storage.capture(first.billing.executionId, [{ id: 'late', measure: 'token-count', units: 4 }]);
    const result = await f.storage.finish(
      first.billing.executionId,
      { status: 'succeeded', measurementComplete: true },
      { text: 'recovered' },
    );
    expect(result.billing).toMatchObject({
      executionStatus: 'completed',
      observedUnits: 4,
      billedUnits: 4,
      settlementStatus: 'settled',
    });
    await f.storage.finish(first.billing.executionId, { status: 'succeeded', measurementComplete: true }, null);
    expect((await totals(f)).ledger).toEqual([{ units: 4n, outcome: 'completed' }]);
    expect((await totals(f)).holds[0].active).toBe(0n);
  }
});

it.each(['matching', 'changed payload', 'other account'] as const)(
  'pending debits release capacity only for exact reflection: %s',
  async reflection => {
    const f = await fixture(charges[3]);
    await seedHistory(f, 8);
    const events = (await totals(f)).events.map(row => JSON.parse(String(row.payload)) as UsageEvent);
    const account = events[0].account;
    const foreign = await f.provider.ensureAccount({ workspaceId: f.bob.workspaceId });
    await f.observer.execute({
      sql: 'INSERT INTO commercial_meters SELECT ?, key, funding, balance, consumed, period_start, period_end FROM commercial_meters WHERE account_id = ?',
      args: [foreign.id, account.id],
    });
    await f.observer.batch(
      events.map((event, index) => ({
        sql: 'INSERT INTO immutable_usage (id, account_id, meter, execution_id, policy_version, units, occurred_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          event.id,
          index === 0 && reflection === 'other account' ? foreign.id : account.id,
          event.meter,
          event.executionId,
          event.policyVersion,
          event.units,
          event.occurredAt,
          JSON.stringify(
            index === 0 && reflection === 'changed payload' ? { ...event, units: event.units + 1 } : event,
          ),
        ],
      })),
      'write',
    );
    expect((await f.observer.execute('SELECT units FROM billing_unreflected_debits')).rows).toEqual(
      reflection === 'matching' ? [] : [{ units: 2n }],
    );
    await f.observer.execute({
      sql: "UPDATE commercial_meters SET funding = 'prepaid', balance = 3 WHERE account_id = ? AND key = 'tasks'",
      args: [account.id],
    });
    f.config.resourcePolicies[0].policy.charge = { type: 'per-task', meter: 'tasks', units: 2, funding: 'prepaid' };
    const identity = await f.organizations.accountingIdentity(f.context);
    const admission = f.storage.admit(
      {
        identity,
        runtimeId: 'reflection-check',
        resourceId: 'assistant',
        operation: 'generate',
        key: 'after-reflection',
        fingerprint: 'reflection-check',
      },
      f.config.resourcePolicies[0],
      await f.provider.getState(account),
      undefined,
      f.provider.bindUsage('tasks'),
    );
    if (reflection === 'matching') expect(await admission).toMatchObject({ status: 'admitted' });
    else await expect(admission).rejects.toMatchObject({ code: 'insufficient_credits' });
  },
);

it('migration indexes only pending debits and preserves retained financial history', async () => {
  const f = await fixture(charges[3]);
  const events = await seedHistory(f, 1000);
  await f.observer.batch(
    events.map(event => ({
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
    })),
    'write',
  );
  const history = async () =>
    Promise.all(
      ['billing_ledger', 'billing_outbox', 'immutable_usage'].map(
        async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows,
      ),
    );
  const before = await history();
  await removeUnreflectedMigration(f.observer);
  const oldMigrations = (await f.observer.execute('SELECT version, checksum FROM billing_migrations ORDER BY version'))
    .rows;
  const reopened = await LocalBillingStorage.open({ url: f.database.url });
  try {
    expect(await history()).toEqual(before);
    expect(
      (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version < 5 ORDER BY version'))
        .rows,
    ).toEqual(oldMigrations);
    expect((await f.observer.execute('SELECT units FROM billing_unreflected_debits')).rows).toEqual([{ units: 2n }]);
    const plan = await f.observer.execute({
      sql: 'EXPLAIN QUERY PLAN SELECT units FROM billing_unreflected_debits WHERE account_id = ? AND meter = ?',
      args: [events[0].account.id, events[0].meter],
    });
    expect(
      plan.rows.some(
        row => String(row.detail).includes('SEARCH') && String(row.detail).includes('account_id=? AND meter=?'),
      ),
    ).toBe(true);
  } finally {
    reopened.close();
  }
}, 30000);

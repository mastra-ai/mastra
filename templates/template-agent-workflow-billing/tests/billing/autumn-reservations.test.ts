import { CommercialService } from '../../src/billing/runtime/commercial.js';
import { CommercialStorage } from '../../src/billing/storage/commercial.js';
import { configurationFile } from '../support/configuration-files.js';
import { AutumnBillingProvider } from '../../src/billing/providers/autumn/index.js';
import { imagePolicies } from '../support/image-configuration.js';
import { createImageApplication } from '../support/image-application.js';
import { fork } from 'node:child_process';
import { billingPolicySchema } from '../../src/billing/configuration/policy.js';
import { weatherDefinitions } from '../support/weather/resources.js';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { BillingGateway } from '../../src/billing/runtime/gateway.js';
import { LocalBillingProvider } from '../../src/billing/providers/local/index.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { BillingRecovery } from '../../src/billing/runtime/recovery.js';
import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
import { independentClient } from '../support/billing.js';
import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { createBillingApplication } from '../../src/billing/application.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { billingSocket } from '../support/http.js';
import { modelBoundary, runtimeFixture, mastraConfiguration, operationBarrier } from '../support/mastra.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { autumnFixture } from '../support/autumn.js';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture() {
  const value = await autumnFixture();
  cleanups.push(value.close);
  return value;
}

async function nativeFixture(
  options: Pick<
    Parameters<typeof runtimeFixture>[0],
    'workflowPrompt' | 'workflowAfterPrompt' | 'workflowAfterBoundary'
  > & {
    paidAgent?: boolean;
    executionMs?: number;
  } = {},
) {
  const f = await fixture();
  const model = await modelBoundary();
  cleanups.push(model.close);
  const base = mastraConfiguration(f.owner.workspaceId);
  const configuration = {
    ...base,
    provider: 'autumn',
    localAccounts: [],
    billingKeys: {
      entitlements: [],
      subscriptions: [],
      meters: [{ key: 'credits', unit: 'credits' as const, funding: ['prepaid' as const] }],
    },
    resourcePolicies: base.resourcePolicies.map(resource => ({
      ...resource,
      policy: {
        ...resource.policy,
        suspendedReservationTtlMs: undefined,
        ...(options.executionMs && {
          reservationBudget: {
            executionMs: options.executionMs,
            finalizationMs: 30_000,
            expiryMarginMs: 30_000,
            lifetimeMs: 2_000_000,
          },
        }),
        charge:
          resource.id === 'report' || options.paidAgent
            ? { type: 'credits' as const, meter: 'credits', units: 2 }
            : { type: 'none' as const },
      },
    })),
  };
  const open = () =>
    runtimeFixture({
      databaseUrl: f.database.url,
      directory: f.database.directory,
      modelUrl: model.url,
      organizations: f.organizations,
      billingContext: f.context,
      provider: f.provider(),
      configuration,
      workflowPrompt: options.workflowPrompt,
      workflowAfterPrompt: options.workflowAfterPrompt,
      workflowAfterBoundary: options.workflowAfterBoundary,
    });
  const runtime = await open();
  cleanups.push(runtime.close);
  return { ...f, model, runtime, open };
}

it('lost finalization acknowledgements recover after the default log window has passed', async () => {
  const f = await fixture();
  f.behavior.dropFinalize = true;
  const result = await f.execute('old-confirmation');
  expect(result.billing).toMatchObject({ settlementStatus: 'pending', billedUnits: null });
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(Date.now() + 31 * 60_000);
    await f.restart();
    await f.storage().recoverFinancial();
    expect((await f.read(result.billing.executionId)).billing).toMatchObject({
      settlementStatus: 'settled',
      billedUnits: 3,
    });
    expect(f.requests.filter(request => request.path === '/v1/balances.finalize')).toHaveLength(1);
    expect(f.computes()).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

it('a missing Autumn balance returns zero funds and a definite reservation denial', async () => {
  const f = await fixture();
  f.behavior.missingBalance = true;
  const account = await f.provider().ensureAccount({ workspaceId: f.owner.workspaceId });
  expect((await f.provider().getState(account)).meters).toMatchObject([
    { key: 'credits', confirmedBalance: 0, providerUsageIncludingHolds: 0 },
  ]);
  await expect(f.execute('no-grant')).rejects.toMatchObject({ code: 'insufficient_credits' });
  expect(f.computes()).toBe(0);
  expect((await f.execute('no-grant')).billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
  expect(f.locks.size).toBe(0);
});

it('equivalent provider accounts allow execution regardless of property insertion order', async () => {
  const f = await fixture();
  const ensureAccount = f.provider().ensureAccount.bind(f.provider());
  vi.spyOn(f.provider(), 'ensureAccount').mockImplementation(async input => {
    const account = await ensureAccount(input);
    return {
      externalReference: account.externalReference,
      provider: account.provider,
      workspaceId: account.workspaceId,
      id: account.id,
    };
  });
  expect((await f.execute('reordered-account')).billing).toMatchObject({
    executionStatus: 'completed',
    billedUnits: 3,
  });
  expect(f.computes()).toBe(1);
});

describe('Autumn reservation lifecycle over the actual SDK and SQL', () => {
  it('Autumn reservation success and failure have one financial effect', async () => {
    const f = await fixture();
    const success = await f.execute('success');
    expect(success).toMatchObject({
      result: { answer: 'private' },
      billing: {
        executionStatus: 'completed',
        billedUnits: 3,
        settlementStatus: 'settled',
        deliveryStatus: 'not_required',
      },
    });
    expect(f.behavior.balance).toBe(7);
    await f.restart();
    expect(await f.execute('success')).toMatchObject({ billing: { replayed: true, billedUnits: 3 } });
    expect(f.computes()).toBe(1);
    f.outcome({ status: 'failed', result: { partial: true } });
    expect(await f.execute('failure')).toMatchObject({
      billing: { executionStatus: 'failed', billedUnits: 0, settlementStatus: 'released' },
    });
    expect(f.behavior.balance).toBe(7);
    expect(f.locks.size).toBe(0);
    expect((await f.observer.execute('SELECT units FROM billing_ledger ORDER BY units')).rows).toEqual([
      { units: 0n },
      { units: 3n },
    ]);
    expect((await f.observer.execute('SELECT id FROM billing_outbox')).rows).toEqual([]);
    expect(f.requests.every(value => value.version === '2.6.0')).toBe(true);
    expect(
      f.requests.filter(value => value.path === '/v1/balances.check' && value.body.lock).map(value => value.body),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          required_balance: 3,
          lock: expect.objectContaining({ enabled: true, expires_at: expect.any(Number), lock_id: expect.any(String) }),
        }),
      ]),
    );
    expect(f.requests.some(value => value.body.send_event || value.path.includes('track'))).toBe(false);
  });

  it('lost reservation and finalization acknowledgements recover without recompute', async () => {
    const reserve = await fixture();
    reserve.behavior.dropReserve = true;
    const pending = await reserve.execute('lost-reserve');
    expect(pending.billing).toMatchObject({ billedUnits: null, settlementStatus: 'uncertain' });
    expect(reserve.computes()).toBe(0);
    expect(reserve.locks.size).toBe(1);
    await reserve.restart();
    await reserve.storage().recoverFinancial();
    expect((await reserve.execute('lost-reserve')).billing.billedUnits).toBeNull();
    expect(reserve.requests.filter(value => value.body.lock)).toHaveLength(1);
    expect(reserve.computes()).toBe(0);

    const final = await fixture();
    final.behavior.dropFinalize = true;
    final.behavior.visibleLogs = false;
    const completed = await final.execute('lost-confirm');
    expect(completed).toMatchObject({
      result: { answer: 'private' },
      billing: { executionStatus: 'completed', settlementStatus: 'pending', billedUnits: null },
    });
    expect(final.behavior.balance).toBe(7);
    await final.restart();
    await final.storage().recoverFinancial();
    expect((await final.read(completed.billing.executionId)).billing.billedUnits).toBeNull();
    final.behavior.visibleLogs = true;
    const positive = final.logs[0];
    final.logs[0] = { ...positive, status_code: 400 };
    await final.storage().recoverFinancial();
    expect((await final.read(completed.billing.executionId)).billing.billedUnits).toBeNull();
    final.logs[0] = { ...positive, request_body: { ...(positive.request_body as object), override_value: 2 } };
    await final.storage().recoverFinancial();
    expect((await final.read(completed.billing.executionId)).billing.billedUnits).toBeNull();
    final.logs[0] = positive;
    await final.storage().recoverFinancial();
    expect((await final.execute('lost-confirm')).billing).toMatchObject({
      settlementStatus: 'settled',
      billedUnits: 3,
      replayed: true,
    });
    expect(final.computes()).toBe(1);
    expect(final.requests.filter(value => value.path === '/v1/balances.finalize')).toHaveLength(1);
    expect((await final.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
  });

  it('Autumn outage insufficient balance and invalid lock budgets deny compute', async () => {
    for (const scenario of [
      'accepted-202',
      'outage',
      'insufficient',
      'unmapped-cost',
      'unlimited',
      'overage',
    ] as const) {
      const f = await fixture();
      if (scenario === 'accepted-202') f.behavior.reserveStatus = 202;
      if (scenario === 'outage') f.behavior.reserveStatus = 503;
      if (scenario === 'insufficient') f.behavior.balance = 2;
      if (scenario === 'unmapped-cost') f.behavior.cost = 2;
      if (scenario === 'unlimited') f.behavior.unlimited = true;
      if (scenario === 'overage') f.behavior.overage = true;
      if (scenario === 'insufficient') {
        await expect(f.execute(scenario)).rejects.toMatchObject({ code: 'insufficient_credits' });
        expect(f.computes()).toBe(0);
        expect((await f.execute(scenario)).billing.billedUnits).toBe(0);
        continue;
      }
      const result = await f.execute(scenario);
      expect(f.computes(), scenario).toBe(0);
      expect(result.billing.billedUnits, scenario).toBeNull();
      expect(f.requests.filter(value => value.body.lock).length, scenario).toBeLessThanOrEqual(1);
    }
    const invalid = await fixture();
    const configuration = {
      ...invalid.configuration,
      resourcePolicies: [
        imagePolicies[0],
        {
          ...imagePolicies[1],
          policy: {
            ...imagePolicies[1].policy,
            reservationBudget: { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 5000 },
          },
        },
      ],
    };
    await expect(
      createImageApplication({
        environment: {
          BILLING_PROVIDER: 'autumn',
          BILLING_MODE: 'production',
          BILLING_IDENTITY_CONFIG_FILE: configurationFile(invalid.database.directory, invalid.jwtConfiguration),
          BILLING_DATABASE_URL: invalid.database.url,
          BILLING_PROJECT_ROOT: invalid.database.directory,
          BILLING_CONFIG_FILE: configurationFile(invalid.database.directory, configuration),
          OPENAI_API_KEY: 'controlled',
        },
        billingProvider: await AutumnBillingProvider.open({ url: invalid.database.url }, invalid.options),
      }).then(app => app.close()),
    ).rejects.toMatchObject({ code: 'invalid_configuration' });
    expect(invalid.requests).toEqual([]);
    const validConfiguration = {
      ...configuration,
      resourcePolicies: [
        configuration.resourcePolicies[0],
        {
          ...configuration.resourcePolicies[1],
          policy: {
            ...configuration.resourcePolicies[1].policy,
            reservationBudget: { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 2_000_000 },
          },
        },
      ],
    };
    const validApplication = await createImageApplication({
      environment: {
        BILLING_PROVIDER: 'autumn',
        BILLING_MODE: 'production',
        BILLING_IDENTITY_CONFIG_FILE: configurationFile(invalid.database.directory, invalid.jwtConfiguration),
        BILLING_DATABASE_URL: invalid.database.url,
        BILLING_PROJECT_ROOT: invalid.database.directory,
        BILLING_CONFIG_FILE: configurationFile(invalid.database.directory, validConfiguration),
        OPENAI_API_KEY: 'controlled',
      },
      billingProvider: await AutumnBillingProvider.open({ url: invalid.database.url }, invalid.options),
    });
    await validApplication.close();

    const f = await fixture();
    f.behavior.balance = 3;
    const race = await Promise.allSettled([f.execute('john'), f.execute('emma')]);
    expect(
      race
        .filter(value => value.status === 'fulfilled')
        .map(value => value.status === 'fulfilled' && value.value.billing.billedUnits),
    ).toEqual([3]);
    expect(race.filter(value => value.status === 'rejected')).toMatchObject([
      { reason: { code: 'insufficient_credits' } },
    ]);
    expect(f.computes()).toBe(1);
    expect(f.behavior.balance).toBe(0);
  });

  it.each(['exact-fit', 'exhausted'] as const)(
    'Autumn initial admission respects the fixed cutoff with an %s budget',
    async scenario => {
      const f = await fixture();
      const budget = { executionMs: 1000, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 3000 };
      Object.assign(f.configuration.resourcePolicies[0].policy, { reservationBudget: budget });
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        if (scenario === 'exhausted')
          f.hooks.afterReserve = async () => {
            vi.setSystemTime(Date.now() + budget.executionMs);
          };
        const receipt = await f.execute(scenario);
        const exhausted = scenario === 'exhausted';
        expect(receipt.billing).toMatchObject({
          executionStatus: exhausted ? 'failed' : 'completed',
          settlementStatus: exhausted ? 'released' : 'settled',
          billedUnits: exhausted ? 0 : 3,
        });
        expect(f.computes()).toBe(exhausted ? 0 : 1);
        expect(
          f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
        ).toEqual([exhausted ? 'release' : 'confirm']);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('API 202 finalization never reports confirmed debit or zero charge', async () => {
    const f = await fixture();
    f.behavior.finalizeStatus = 202;
    const result = await f.execute('accepted-confirm');
    expect(result.billing).toMatchObject({
      executionStatus: 'completed',
      settlementStatus: 'pending',
      billedUnits: null,
    });
    await f.storage().recoverFinancial();
    expect((await f.read(result.billing.executionId)).billing.billedUnits).toBeNull();
    expect(f.requests.filter(value => value.path === '/v1/balances.finalize')).toHaveLength(1);
  });
  it('Autumn workflow suspension restart resume and cancellation retain the same remote reservation', async () => {
    const f = await nativeFixture();
    const { model, open } = f;
    let runtime = f.runtime;
    const run = await runtime.billing.workflow('report').createRun({ billing: f.context, idempotencyKey: 'kit' });
    const started = await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
    expect(started.billing).toMatchObject({ settlementStatus: 'reserved', billedUnits: null });
    expect(f.locks.size).toBe(1);
    await runtime.close();
    await f.restart();
    runtime = await open();
    cleanups.push(runtime.close);
    const restored = await runtime.billing
      .workflow('report')
      .getRun({ executionId: run.executionId, billing: f.context });
    const resumed = await restored.resume({
      billing: f.context,
      idempotencyKey: 'approve',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(resumed.billing).toMatchObject({ settlementStatus: 'settled', billedUnits: 2 });
    expect(
      (
        await restored.resume({
          billing: f.context,
          idempotencyKey: 'approve',
          step: 'approval',
          resumeData: { approved: true },
        })
      ).billing,
    ).toMatchObject({ billedUnits: 2 });
    expect(model.requests).toHaveLength(2);
    expect(f.behavior.balance).toBe(8);
    const canceled = await runtime.billing
      .workflow('report')
      .createRun({ billing: f.context, idempotencyKey: 'cancel-kit' });
    await canceled.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
    expect((await canceled.cancel({ billing: f.context, idempotencyKey: 'cancel' })).billing).toMatchObject({
      settlementStatus: 'released',
      billedUnits: 0,
    });
    expect(f.behavior.balance).toBe(8);
    expect(f.locks.size).toBe(0);
    expect(f.requests.filter(value => value.body.lock)).toHaveLength(2);
  });

  it.each(['acknowledged', 'reserve-ack-lost', 'release-ack-lost', 'release-claim-interrupted'] as const)(
    'Autumn cancel before native start settles only a proven hold with %s',
    async evidence => {
      const f = await nativeFixture();
      f.behavior.dropReserve = evidence === 'reserve-ack-lost';
      f.behavior.dropFinalize = evidence === 'release-ack-lost';
      f.behavior.visibleLogs = false;
      const response = operationBarrier();
      f.hooks.afterReserve = response.pause;
      if (evidence === 'release-claim-interrupted')
        await f.observer.execute(
          "CREATE TRIGGER interrupt_cancel_release BEFORE UPDATE OF terminal_dispatched ON billing_remote_operations WHEN NEW.terminal_dispatched = 1 BEGIN SELECT RAISE(ABORT, 'Interrupted cancellation settlement'); END",
        );
      const run = await f.runtime.billing
        .workflow('report')
        .createRun({ billing: f.context, idempotencyKey: 'cancel-pending-reserve' });
      const start = { billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } };
      const cancel = { billing: f.context, idempotencyKey: 'cancel' };
      const pending = run.start(start);
      try {
        await response.entered;
        expect(f.locks.size).toBe(1);
        const canceled = await run.cancel(cancel);
        expect(canceled.billing?.billedUnits).toBeNull();
        expect(f.requests.filter(request => request.path === '/v1/balances.finalize')).toEqual([]);
        response.release();
        if (evidence === 'release-claim-interrupted') {
          await expect(pending).rejects.toMatchObject({ code: 'storage_unavailable' });
          expect((await run.status(f.context)).billing).toMatchObject({
            executionStatus: 'canceled',
            settlementStatus: 'pending',
            billedUnits: null,
          });
          expect(f.locks.size).toBe(1);
          await f.observer.execute('DROP TRIGGER interrupt_cancel_release');
        } else await pending;
        await f.runtime.close();
        await f.restart();
        await f.storage().recoverFinancial();
        const reopened = await f.open();
        cleanups.push(reopened.close);
        const replay = await reopened.billing
          .workflow('report')
          .getRun({ billing: f.context, executionId: run.executionId });
        const expected =
          evidence === 'acknowledged' || evidence === 'release-claim-interrupted'
            ? { settlementStatus: 'released', billedUnits: 0 }
            : { settlementStatus: evidence === 'reserve-ack-lost' ? 'uncertain' : 'pending', billedUnits: null };
        expect(await replay.start(start)).toMatchObject({
          result: { status: 'canceled' },
          billing: { executionStatus: 'canceled', ...expected },
        });
        expect((await replay.cancel(cancel)).billing).toMatchObject(expected);
        expect(f.model.requests).toHaveLength(0);
        expect(await reopened.workflows.report.native.getWorkflowRunById(run.executionId)).toBeNull();
        expect(f.requests.filter(request => request.body.lock)).toHaveLength(1);
        const finalizations = () =>
          f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body);
        if (evidence === 'reserve-ack-lost') {
          expect(f.locks.size).toBe(1);
          expect(finalizations()).toEqual([]);
        } else {
          expect(f.locks.size).toBe(0);
          expect(finalizations()).toEqual([
            { action: 'release', customer_id: 'johns-org', lock_id: `reserve:${run.executionId}` },
          ]);
          if (evidence === 'release-ack-lost') {
            f.behavior.visibleLogs = true;
            await f.storage().recoverFinancial();
            expect((await replay.status(f.context)).billing).toMatchObject({
              executionStatus: 'canceled',
              settlementStatus: 'released',
              billedUnits: 0,
            });
            expect(finalizations()).toHaveLength(1);
          }
        }
      } finally {
        response.release();
        await pending.catch(() => {});
      }
    },
  );

  it.each(['before accounting', 'after acknowledgement', 'during native preparation'] as const)(
    'Autumn cancel %s prevents the initial native dispatch',
    async boundary => {
      const f = await nativeFixture();
      const barrier = operationBarrier();
      const claimReservation = f.runtime.accounting.claimReservation.bind(f.runtime.accounting);
      const beginSegment = f.runtime.accounting.beginSegment.bind(f.runtime.accounting);
      const createRun = f.runtime.workflows.report.native.createRun.bind(f.runtime.workflows.report.native);
      const observe =
        boundary === 'before accounting'
          ? vi.spyOn(f.runtime.accounting, 'claimReservation').mockImplementation(async (...args) => {
              await barrier.pause();
              return claimReservation(...args);
            })
          : boundary === 'after acknowledgement'
            ? vi.spyOn(f.runtime.accounting, 'beginSegment').mockImplementation(async (...args) => {
                await barrier.pause();
                return beginSegment(...args);
              })
            : vi.spyOn(f.runtime.workflows.report.native, 'createRun').mockImplementationOnce(async (...args) => {
                const native = await createRun(...args);
                await barrier.pause();
                return native;
              });
      try {
        const run = await f.runtime.billing
          .workflow('report')
          .createRun({ billing: f.context, idempotencyKey: 'cancel-before-native' });
        const start = { billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } };
        const pending = run.start(start);
        try {
          await barrier.entered;
          const noReserve = boundary === 'before accounting';
          expect(f.locks.size).toBe(noReserve ? 0 : 1);
          const canceled = await run.cancel({ billing: f.context, idempotencyKey: 'cancel' });
          expect(canceled.result).toMatchObject({ status: 'canceled' });
          if (noReserve) expect(canceled.billing).toBeNull();
          else expect(canceled.billing).toMatchObject({ settlementStatus: 'released', billedUnits: 0 });
          barrier.release();
          if (noReserve) await expect(pending).rejects.toMatchObject({ code: 'conflict' });
          else expect((await pending).billing).toMatchObject({ executionStatus: 'canceled', billedUnits: 0 });
          expect((await run.start(start)).result).toMatchObject({ status: 'canceled' });
          expect(f.model.requests).toHaveLength(0);
          expect(f.locks.size).toBe(0);
          expect(f.requests.filter(request => request.body.lock)).toHaveLength(noReserve ? 0 : 1);
          expect(
            f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
          ).toEqual(noReserve ? [] : ['release']);
        } finally {
          barrier.release();
          await pending.catch(() => {});
        }
      } finally {
        observe.mockRestore();
      }
    },
  );

  it.each([
    ['autumn', 'known outcome'],
    ['local', 'known outcome'],
    ['autumn', 'claimed finalization'],
    ['local', 'claimed finalization'],
  ] as const)('a different runtime provider preserves the original %s %s', async (original, phase) => {
    const f = await fixture();
    const localStorage = await LocalBillingStorage.open({ url: f.database.url });
    const accounting = await AccountingStorage.open({ url: f.database.url }, f.organizations.storage);
    cleanups.push(async () => {
      accounting.close();
      localStorage.close();
    });
    const localConfig = {
      ...f.configuration,
      provider: 'local',
      localAccounts: [
        {
          workspaceId: f.owner.workspaceId,
          meters: [{ key: 'credits', funding: 'prepaid' as const, balance: 10, periodStart: null, periodEnd: null }],
          entitlements: [],
          subscriptions: [],
        },
      ],
    };
    const local = new LocalBillingProvider(localStorage, localConfig);
    let localComputes = 0;
    const localGateway = new BillingGateway(f.organizations, accounting, local, localConfig, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => {
          localComputes++;
          return { status: 'succeeded', result: { answer: 'local' } };
        },
      },
    ]);
    const execute =
      original === 'autumn'
        ? () => f.execute('provider-switch')
        : () =>
            localGateway.execute(f.context, {
              resourceId: 'assistant',
              operation: 'generate',
              idempotencyKey: 'provider-switch',
              input: { prompt: 'hello' },
            });
    // Persist either the known outcome or the already claimed provider payload.
    const failure =
      phase === 'known outcome'
        ? 'UPDATE OF terminal_dispatched ON billing_remote_operations WHEN NEW.terminal_dispatched = 1'
        : "UPDATE OF terminal_state ON billing_remote_operations WHEN NEW.terminal_state = 'confirmed'";
    await f.observer.execute(
      `CREATE TRIGGER interrupt_settlement BEFORE ${failure} BEGIN SELECT RAISE(ABORT, 'Interrupted settlement'); END`,
    );
    await expect(execute()).rejects.toMatchObject({ code: 'storage_unavailable' });
    const pending = await execute();
    expect(pending.billing).toMatchObject({
      executionStatus: 'completed',
      settlementStatus: 'pending',
      billedUnits: null,
    });
    await f.observer.execute('DROP TRIGGER interrupt_settlement');
    const originalOperation = async () => (await f.observer.execute('SELECT * FROM billing_remote_operations')).rows[0];
    const before = await originalOperation();
    expect(before.terminal_dispatched).toBe(phase === 'known outcome' ? 0n : 1n);

    // A real runtime opens the database with the other driver's codecs.
    await f.restart();
    const other = original === 'autumn' ? local : f.provider();
    const prepare = vi.spyOn(other.reservations, 'prepareFinalization');
    const lookup = vi.spyOn(other.reservations, 'reconcileFinalization');
    const wrongAccounting = original === 'autumn' ? accounting : f.storage();
    const wireRequests = f.requests.length;
    await expect.soft(wrongAccounting.recoverFinancial()).resolves.toBeUndefined();
    await wrongAccounting.settleReservation(pending.billing.executionId);
    expect.soft(await originalOperation()).toEqual(before);
    expect.soft(prepare).not.toHaveBeenCalled();
    expect.soft(lookup).not.toHaveBeenCalled();
    expect(f.requests).toHaveLength(wireRequests);
    prepare.mockRestore();
    lookup.mockRestore();

    await (original === 'autumn' ? f.storage() : accounting).recoverFinancial();
    expect((await execute()).billing).toMatchObject({
      executionStatus: 'completed',
      settlementStatus: 'settled',
      billedUnits: 3,
    });
    expect(f.computes() + localComputes).toBe(1);
    expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
    if (phase === 'claimed finalization')
      expect((await originalOperation()).terminal_payload).toBe(before.terminal_payload);
    if (original === 'autumn') {
      expect(f.behavior.balance).toBe(7);
      expect(f.requests.filter(request => request.path === '/v1/balances.finalize')).toHaveLength(1);
    } else {
      expect((await f.observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
        { state: 'confirmed' },
      ]);
      expect(f.requests).toHaveLength(0);
    }
  });

  it.each(['lost reserve', 'lost release'] as const)(
    'Autumn startup after interrupted initial admission preserves unknown evidence for %s',
    async loss => {
      const f = await nativeFixture();
      f.behavior.dropReserve = loss === 'lost reserve';
      f.behavior.dropFinalize = loss === 'lost release';
      f.behavior.visibleLogs = false;
      const child = fork(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [
          loss === 'lost reserve' ? 'initial-unknown' : 'initial-acknowledged',
          JSON.stringify({
            databaseUrl: f.database.url,
            directory: f.database.directory,
            modelUrl: f.model.url,
            credential: f.owner.credential,
            workspaceId: f.owner.workspaceId,
            configuration: f.runtime.configuration,
            autumn: f.options,
            jwtConfiguration: f.jwtConfiguration,
          }),
        ],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      cleanups.push(async () => {
        if (child.exitCode === null && child.signalCode === null) {
          const exit = once(child, 'exit');
          child.kill('SIGKILL');
          await exit;
        }
      });
      const [interrupted] = (await once(child, 'message')) as [{ executionId: string }];
      expect(f.locks.size).toBe(1);
      const intent = (await f.observer.execute('SELECT reserve_state, reserve_evidence FROM billing_remote_operations'))
        .rows[0];
      expect(intent).toMatchObject(
        loss === 'lost reserve'
          ? { reserve_state: 'uncertain', reserve_evidence: null }
          : { reserve_state: 'reserved', reserve_evidence: expect.any(String) },
      );
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
      await f.runtime.close();
      await f.restart();
      const reopened = await f.open();
      cleanups.push(reopened.close);
      const records = await RecoveryStorage.open({ url: f.database.url });
      cleanups.push(async () => records.close());
      const worker = new BillingRecovery(records, f.provider(), () => reopened.accounting.recoverFinancial());
      cleanups.push(() => worker.stop());
      const run = await reopened.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: interrupted.executionId });
      await worker.runOnce();
      expect((await run.status(f.context)).billing).toMatchObject(
        loss === 'lost reserve'
          ? { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null }
          : { executionStatus: 'failed', settlementStatus: 'pending', billedUnits: null },
      );
      const finalizations = () => f.requests.filter(request => request.path === '/v1/balances.finalize');
      expect(finalizations().map(request => request.body.action)).toEqual(loss === 'lost reserve' ? [] : ['release']);
      expect(f.locks.size).toBe(loss === 'lost reserve' ? 1 : 0);
      f.behavior.visibleLogs = true;
      await worker.runOnce();
      expect((await run.cancel({ billing: f.context, idempotencyKey: 'after-interruption' })).billing).toMatchObject(
        loss === 'lost reserve'
          ? { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null }
          : { executionStatus: 'failed', settlementStatus: 'released', billedUnits: 0 },
      );
      expect(finalizations()).toHaveLength(loss === 'lost reserve' ? 0 : 1);
      expect(f.requests.filter(request => request.body.lock)).toHaveLength(1);
      expect(f.model.requests).toHaveLength(0);
    },
  );

  it.each([
    ['initial failure', 'failed', 'failed', 'release', 0],
    ['initial suspension', 'suspended', 'canceled', 'release', 0],
    ['resumed success', 'success', 'completed', 'confirm', 2],
    ['resumed success past cutoff', 'success', 'failed', 'release', 0],
    ['resumed failure with a failed measurement write', 'failed', 'failed', 'release', 0],
    ['resumed success without owned evidence', 'success', 'uncertain', null, null],
    ['resumed success after local supersession', 'success', 'canceled', 'release', 0],
    ['resumed success after foreign supersession', 'success', 'uncertain', null, null],
  ] as const)(
    'Autumn arbitrates cancellation against %s',
    async (scenario, nativeStatus, status, action, billedUnits) => {
      const f = await nativeFixture({
        workflowPrompt: scenario === 'initial failure' ? '[model-error] fail the workflow' : undefined,
      });
      const supersededLocally = scenario === 'resumed success after local supersession';
      const superseded = supersededLocally || scenario === 'resumed success after foreign supersession';
      const canceler = supersededLocally ? f.runtime : await f.open();
      if (canceler !== f.runtime) cleanups.push(canceler.close);
      const run = await f.runtime.billing
        .workflow('report')
        .createRun({ billing: f.context, idempotencyKey: 'terminal-during-handoff' });
      const start = { billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } };
      const approval = {
        billing: f.context,
        idempotencyKey: 'approve',
        step: 'approval',
        resumeData: { approved: true },
      } as const;
      const resumed = scenario.startsWith('resumed');
      if (resumed) await run.start(start);
      if (scenario === 'resumed failure with a failed measurement write')
        await f.observer.execute(
          "CREATE TRIGGER fail_resume_measurement BEFORE INSERT ON billing_measurements BEGIN SELECT RAISE(ABORT, 'Measurement write interrupted'); END",
        );
      const activation = operationBarrier();
      const complete = f.runtime.workflowStorage.completeNativeHandoff.bind(f.runtime.workflowStorage);
      const pause = vi
        .spyOn(f.runtime.workflowStorage, 'completeNativeHandoff')
        .mockImplementationOnce(async (...args) => {
          if (superseded) {
            const committed = await complete(...args);
            await activation.pause();
            return committed;
          }
          await activation.pause();
          return complete(...args);
        });
      const createRun = f.runtime.workflows.report.native.createRun.bind(f.runtime.workflows.report.native);
      let nativeFinished: Promise<unknown> | undefined;
      const observe = vi
        .spyOn(f.runtime.workflows.report.native, 'createRun')
        .mockImplementationOnce(async (...args) => {
          const native = await createRun(...args);
          if (resumed) {
            const invoke = native.resume.bind(native);
            vi.spyOn(native, 'resume').mockImplementationOnce((...input) => {
              const pending = invoke(...input);
              nativeFinished = pending;
              if (scenario === 'resumed success without owned evidence')
                return pending.then(() => {
                  throw new Error('Controlled loss of the native result');
                });
              return pending;
            });
          } else {
            const invoke = native.start.bind(native);
            vi.spyOn(native, 'start').mockImplementationOnce((...input) => {
              const pending = invoke(...input);
              nativeFinished = pending;
              return pending;
            });
          }
          return native;
        });
      const invoke = () => (resumed ? run.resume(approval) : run.start(start));
      const pending = invoke();
      try {
        await activation.entered;
        await nativeFinished;
        expect((await f.runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe(
          nativeStatus,
        );
        const handle = await canceler.billing
          .workflow('report')
          .getRun({ billing: f.context, executionId: run.executionId });
        const cancellation = { billing: f.context, idempotencyKey: 'deferred-cancel' };
        const beforeCancel = (await f.observer.execute('SELECT terminal_request FROM billing_remote_operations'))
          .rows[0];
        expect(beforeCancel.terminal_request).toBeNull();
        expect(await handle.cancel(cancellation)).toMatchObject({
          kind: 'replay',
          result: { status: supersededLocally ? 'canceled' : superseded ? 'uncertain' : 'canceling' },
          billing: supersededLocally
            ? { executionStatus: 'canceled', settlementStatus: 'released', billedUnits: 0 }
            : { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null },
        });
        expect((await f.observer.execute('SELECT version FROM billing_workflow_runs')).rows).toEqual([
          { version: BigInt((resumed ? 2 : 1) + (superseded ? 1 : 0)) },
        ]);
        expect(f.requests.filter(request => request.path === '/v1/balances.finalize')).toHaveLength(
          supersededLocally ? 1 : 0,
        );
        if (scenario === 'resumed success past cutoff') {
          const { segment_deadline } = (
            await f.observer.execute('SELECT segment_deadline FROM billing_remote_operations')
          ).rows[0];
          vi.useFakeTimers({ toFake: ['Date'] });
          vi.setSystemTime(Number(segment_deadline) + 1);
        }
        activation.release();
        const expected = {
          executionStatus: status,
          settlementStatus: action === null ? 'uncertain' : action === 'release' ? 'released' : 'settled',
          billedUnits,
        };
        const completed = await pending;
        expect(completed.billing).toMatchObject(expected);
        if (scenario === 'resumed success')
          expect(completed).toMatchObject({
            kind: 'immediate',
            result: { status: 'success', result: { count: 2 } },
          });
        if (scenario === 'resumed success past cutoff' || superseded || action === null)
          expect(completed).toMatchObject({
            kind: 'replay',
            result: { status },
          });
        expect((await handle.cancel(cancellation)).billing).toMatchObject(expected);
        expect((await handle.cancel({ ...cancellation, idempotencyKey: 'late-cancel' })).billing).toMatchObject(
          expected,
        );
        expect((await invoke()).billing).toMatchObject(expected);
        await f.runtime.accounting.recoverFinancial();
        expect(
          f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
        ).toEqual(action === null ? [] : [action]);
        expect(f.locks.size).toBe(action === null ? 1 : 0);
        expect(f.behavior.balance).toBe(10 - (billedUnits ?? 0));
        expect(f.requests.filter(request => request.body.lock)).toHaveLength(1);
        expect(f.model.requests).toHaveLength(resumed ? 2 : 1);
        expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual(
          billedUnits === null ? [] : [{ units: BigInt(billedUnits) }],
        );
      } finally {
        activation.release();
        await pending.catch(() => {});
        pause.mockRestore();
        observe.mockRestore();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    'resume preparation',
    'resume handoff',
    'missing resume preparation',
    'superseded resume preparation',
    'missing native suspension',
    'lost native cancel acknowledgement',
  ] as const)('Autumn cancel during %s releases only with current suspension evidence', async boundary => {
    const f = await nativeFixture();
    const run = await f.runtime.billing
      .workflow('report')
      .createRun({ billing: f.context, idempotencyKey: 'suspended-before-resume' });
    expect(
      (await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } })).billing,
    ).toMatchObject({ settlementStatus: 'reserved' });
    const gate = operationBarrier();
    const segment = f.runtime.accounting.segmentDeadline.bind(f.runtime.accounting);
    const begin = f.runtime.workflowStorage.beginNativeHandoff.bind(f.runtime.workflowStorage);
    const pause =
      boundary !== 'resume handoff'
        ? vi.spyOn(f.runtime.accounting, 'segmentDeadline').mockImplementationOnce(async (...args) => {
            const deadline = await segment(...args);
            await gate.pause();
            return deadline;
          })
        : vi.spyOn(f.runtime.workflowStorage, 'beginNativeHandoff').mockImplementationOnce(async (...args) => {
            await begin(...args);
            await gate.pause();
          });
    const approval = {
      billing: f.context,
      idempotencyKey: 'approve',
      step: 'approval',
      resumeData: { approved: true },
    } as const;
    const missingPreparation =
      boundary === 'missing resume preparation' || boundary === 'superseded resume preparation';
    if (missingPreparation) {
      // A real SQL storage fault omits the current preparation or leaves only
      // another version's evidence. Restore the exact supported schema before
      // reopening; absent evidence must never authorize a financial release.
      const superseded =
        boundary === 'superseded resume preparation'
          ? 'INSERT INTO billing_workflow_resume_preparations VALUES (NEW.execution_id, NEW.version + 1);'
          : '';
      await f.observer.execute(
        `CREATE TRIGGER fault_resume_preparation BEFORE INSERT ON billing_workflow_resume_preparations WHEN NEW.version = 2 BEGIN ${superseded} SELECT RAISE(IGNORE); END`,
      );
    }
    const pending = run.resume(approval);
    try {
      await gate.entered;
      expect((await f.runtime.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('suspended');
      if (missingPreparation) {
        await f.observer.execute('DROP TRIGGER fault_resume_preparation');
        expect((await f.observer.execute('SELECT version FROM billing_workflow_resume_preparations')).rows).toEqual(
          boundary === 'superseded resume preparation' ? [{ version: 3n }] : [],
        );
      }
      if (boundary === 'missing native suspension')
        await (await f.runtime.mastra.getStorage()!.getStore('workflows'))!.deleteWorkflowRunById({
          runId: run.executionId,
          workflowName: 'report',
        });
      const canceler = await f.open();
      cleanups.push(canceler.close);
      if (boundary === 'lost native cancel acknowledgement') {
        const createRun = canceler.workflows.report.native.createRun.bind(canceler.workflows.report.native);
        vi.spyOn(canceler.workflows.report.native, 'createRun').mockImplementationOnce(async (...args) => {
          const native = await createRun(...args);
          const cancel = native.cancel.bind(native);
          vi.spyOn(native, 'cancel').mockImplementationOnce(async () => {
            await cancel();
            throw new Error('Controlled loss after the native cancel persisted');
          });
          return native;
        });
      }
      const foreign = await canceler.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: run.executionId });
      const request = { billing: f.context, idempotencyKey: 'cancel' };
      const cancellation = await foreign.cancel(request);
      const known = !missingPreparation && boundary !== 'missing native suspension';
      const expected = known
        ? { executionStatus: 'canceled', settlementStatus: 'released', billedUnits: 0 }
        : { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null };
      if (boundary !== 'resume handoff') expect(cancellation.billing).toMatchObject(expected);
      else
        expect(cancellation).toMatchObject({
          kind: 'replay',
          result: { status: 'canceling' },
          billing: { billedUnits: null },
        });
      expect((await f.observer.execute('SELECT version FROM billing_workflow_runs')).rows).toEqual([
        { version: boundary === 'resume handoff' ? 2n : 3n },
      ]);
      gate.release();
      expect((await pending).billing).toMatchObject(expected);
      expect((await foreign.cancel(request)).billing).toMatchObject(expected);
      expect((await run.resume(approval)).billing).toMatchObject(expected);
      if (boundary !== 'missing native suspension')
        expect((await canceler.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
      expect(f.model.requests).toHaveLength(1);
      expect(
        (await readFile(join(f.database.directory, 'workflow-events.jsonl'), 'utf8'))
          .trim()
          .split('\n')
          .map(line => JSON.parse(line)),
      ).toEqual([{ step: 'before' }]);
      expect(
        f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
      ).toEqual(known ? ['release'] : []);
      expect(f.locks.size).toBe(known ? 0 : 1);
      expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual(known ? [{ units: 0n }] : []);
    } finally {
      gate.release();
      await pending.catch(() => {});
      pause.mockRestore();
    }
  });

  it.each([
    'before native cancel',
    'native snapshot write fails',
    'after native cancel',
    'after release candidate',
    'lost release acknowledgement',
  ] as const)('Autumn explicit cancellation recovers an interruption %s', async boundary => {
    const f = await nativeFixture();
    const canceler = await f.open();
    cleanups.push(canceler.close);
    const run = await f.runtime.billing
      .workflow('report')
      .createRun({ billing: f.context, idempotencyKey: 'recover-explicit-cancel' });
    await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
    const preparing = operationBarrier();
    const segment = f.runtime.accounting.segmentDeadline.bind(f.runtime.accounting);
    const pause = vi.spyOn(f.runtime.accounting, 'segmentDeadline').mockImplementationOnce(async (...args) => {
      const deadline = await segment(...args);
      await preparing.pause();
      return deadline;
    });
    const approval = {
      billing: f.context,
      idempotencyKey: 'approve',
      step: 'approval',
      resumeData: { approved: true },
    } as const;
    const resuming = run.resume(approval);
    try {
      await preparing.entered;
      const nativeFault = boundary === 'native snapshot write fails';
      const faultDatabase = nativeFault
        ? await independentClient(pathToFileURL(join(f.database.directory, 'workflow.db')).href)
        : f.observer;
      if (nativeFault) cleanups.push(async () => faultDatabase.close());
      const trigger = nativeFault
        ? `UPDATE ON ${TABLE_WORKFLOW_SNAPSHOT} WHEN json_extract(NEW.snapshot, '$.status') = 'canceled'`
        : boundary === 'before native cancel'
          ? 'UPDATE OF confirmed_suspended ON billing_expiry_recovery WHEN NEW.confirmed_suspended = 1'
          : boundary === 'after native cancel'
            ? "UPDATE OF status ON billing_executions WHEN NEW.status = 'canceled'"
            : 'UPDATE OF terminal_dispatched ON billing_remote_operations WHEN NEW.terminal_dispatched = 1';
      if (boundary === 'lost release acknowledgement') {
        f.behavior.dropFinalize = true;
        f.behavior.visibleLogs = false;
      } else
        await faultDatabase.execute(
          `CREATE TRIGGER interrupt_explicit_cancel BEFORE ${trigger} BEGIN SELECT RAISE(ABORT, 'Interrupted explicit cancel'); END`,
        );
      const handle = await canceler.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: run.executionId });
      const request = { billing: f.context, idempotencyKey: 'cancel' };
      const canceled = await Promise.allSettled([handle.cancel(request)]);
      if (boundary === 'after native cancel' || boundary === 'after release candidate')
        expect(canceled).toMatchObject([{ status: 'rejected', reason: { code: 'storage_unavailable' } }]);
      expect((await canceler.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe(
        boundary === 'before native cancel' || nativeFault ? 'suspended' : 'canceled',
      );
      if (boundary !== 'lost release acknowledgement')
        await faultDatabase.execute('DROP TRIGGER interrupt_explicit_cancel');
      const evidence = (await f.observer.execute('SELECT confirmed_suspended FROM billing_expiry_recovery')).rows[0];
      expect(evidence?.confirmed_suspended).toBe(boundary === 'before native cancel' ? 0n : 1n);
      preparing.release();
      await resuming;
      await f.runtime.close();
      await canceler.close();
      await f.restart();
      const reopened = await f.open();
      cleanups.push(reopened.close);
      const other = await f.open();
      cleanups.push(other.close);
      const replay = await reopened.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: run.executionId });
      const recordStorage = await RecoveryStorage.open({ url: f.database.url });
      cleanups.push(async () => recordStorage.close());
      const recovery = new BillingRecovery(recordStorage, f.provider(), async () => {
        await reopened.billing.expireSuspensions();
        await reopened.accounting.recoverFinancial();
      });
      cleanups.push(() => recovery.stop());
      const otherRecords = await RecoveryStorage.open({ url: f.database.url });
      cleanups.push(async () => otherRecords.close());
      const otherRecovery = new BillingRecovery(otherRecords, f.provider(), async () => {
        await other.billing.expireSuspensions();
        await other.accounting.recoverFinancial();
      });
      cleanups.push(() => otherRecovery.stop());
      if (boundary === 'after native cancel') {
        const nativeStore = (await reopened.mastra.getStorage()!.getStore('workflows'))!;
        const canceledSnapshot = await nativeStore.loadWorkflowSnapshot({
          runId: run.executionId,
          workflowName: 'report',
        });
        if (!canceledSnapshot) throw new Error('Expected the committed native cancellation');
        await nativeStore.persistWorkflowSnapshot({
          runId: run.executionId,
          workflowName: 'report',
          snapshot: { ...canceledSnapshot, status: 'running' },
        });
        expect((await replay.cancel(request)).billing).toMatchObject({
          executionStatus: 'uncertain',
          settlementStatus: 'uncertain',
          billedUnits: null,
        });
        expect(f.requests.filter(request => request.path === '/v1/balances.finalize')).toHaveLength(0);
        expect(f.locks.size).toBe(1);
        await nativeStore.persistWorkflowSnapshot({
          runId: run.executionId,
          workflowName: 'report',
          snapshot: canceledSnapshot,
        });
        const stale = (await reopened.workflowStorage.claimExpiry(run.executionId, Date.now(), 100, true))!;
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 101);
        const winner = (await other.workflowStorage.claimExpiry(run.executionId, Date.now(), 100, true))!;
        expect(winner.version).toBeGreaterThan(stale.version);
        await reopened.accounting.finish(
          run.executionId,
          { status: 'canceled', measurements: [], measurementComplete: false },
          null,
          { executionId: run.executionId, version: stale.version, expiryToken: stale.expiry.token },
        );
        await Promise.all([recovery.runOnce(), otherRecovery.runOnce()]);
        expect(f.locks.size).toBe(1);
        expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
        vi.setSystemTime(Date.now() + 101);
      }
      if (boundary === 'after native cancel' || boundary === 'after release candidate')
        await Promise.all([recovery.runOnce(), otherRecovery.runOnce()]);
      // Both public replay keys must preserve the winning cancellation.
      await replay.cancel(request);
      await replay.cancel({ ...request, idempotencyKey: 'cancel-again' });
      await Promise.all([recovery.runOnce(), otherRecovery.runOnce()]);
      if (boundary === 'lost release acknowledgement') {
        expect((await replay.status(f.context)).billing).toMatchObject({
          executionStatus: 'canceled',
          settlementStatus: 'pending',
          billedUnits: null,
        });
        f.behavior.visibleLogs = true;
        await recovery.runOnce();
      }
      expect((await replay.status(f.context)).billing).toMatchObject({
        executionStatus: 'canceled',
        settlementStatus: 'released',
        billedUnits: 0,
      });
      expect((await replay.resume(approval)).billing).toMatchObject({ executionStatus: 'canceled', billedUnits: 0 });
      expect((await reopened.workflows.report.native.getWorkflowRunById(run.executionId))?.status).toBe('canceled');
      expect(f.model.requests).toHaveLength(1);
      expect(f.requests.filter(request => request.body.lock)).toHaveLength(1);
      expect(
        f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
      ).toEqual(['release']);
      expect(f.locks.size).toBe(0);
      expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 0n }]);
    } finally {
      preparing.release();
      await resuming.catch(() => {});
      pause.mockRestore();
      vi.useRealTimers();
    }
  });

  it.each(['customer', 'feature', 'credit-pool'] as const)(
    'Autumn workflow refuses %s drift and resumes after restoring its original binding',
    async drift => {
      const f = await nativeFixture();
      const run = await f.runtime.billing
        .workflow('report')
        .createRun({ billing: f.context, idempotencyKey: 'binding-drift' });
      expect(
        (await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } })).billing,
      ).toMatchObject({ settlementStatus: 'reserved' });
      await f.runtime.close();
      if (drift === 'feature') f.behavior.featureId = 'different-images';
      if (drift === 'credit-pool') f.behavior.creditPoolId = 'different-credits';
      const bindings = {
        ...f.options.bindings,
        customers: f.options.bindings.customers.map(customer => ({
          ...customer,
          customerId: drift === 'customer' ? 'different-customer' : customer.customerId,
        })),
        meters: f.options.bindings.meters.map(meter => ({
          ...meter,
          featureId: f.behavior.featureId,
          creditPoolId: f.behavior.creditPoolId,
        })),
      };
      await f.restart(bindings);
      const drifted = await f.open();
      cleanups.push(drifted.close);
      const restored = await drifted.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: run.executionId });
      const approval = {
        billing: f.context,
        idempotencyKey: 'approve',
        step: 'approval',
        resumeData: { approved: true },
      } as const;
      const before = f.requests.length;
      await expect(restored.resume(approval)).rejects.toMatchObject({ code: 'conflict' });
      expect(f.requests).toHaveLength(before);
      expect(f.model.requests).toHaveLength(1);
      expect((await restored.status(f.context)).billing).toMatchObject({
        settlementStatus: 'reserved',
        billedUnits: null,
      });
      expect(f.locks.size).toBe(1);
      await drifted.close();
      f.behavior.featureId = 'generated_images';
      f.behavior.creditPoolId = 'image_credits';
      await f.restart();
      const compatible = await f.open();
      cleanups.push(compatible.close);
      const original = await compatible.billing
        .workflow('report')
        .getRun({ billing: f.context, executionId: run.executionId });
      expect((await original.resume(approval)).billing).toMatchObject({ settlementStatus: 'settled', billedUnits: 2 });
      expect((await original.resume(approval)).billing).toMatchObject({
        settlementStatus: 'settled',
        billedUnits: 2,
        replayed: true,
      });
      expect(f.model.requests).toHaveLength(2);
      expect(f.requests.filter(request => request.body.lock)).toHaveLength(1);
      expect(
        f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.customer_id),
      ).toEqual(['johns-org']);
    },
  );

  it('revoked authorization releases a confirmed hold before any compute', async () => {
    const f = await fixture();
    f.hooks.afterReserve = async () => {
      await f.observer.execute({ sql: 'UPDATE identities SET active = 0 WHERE id = ?', args: [f.owner.identity.id] });
    };
    await expect(f.execute('revoked')).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(f.computes()).toBe(0);
    expect(f.locks.size).toBe(0);
    expect(f.behavior.balance).toBe(10);
    expect((await f.observer.execute('SELECT status, settlement, billed_units FROM billing_executions')).rows).toEqual([
      { status: 'failed', settlement: 'released', billed_units: 0n },
    ]);
  });

  it('execution deadlines release late success and in-budget dispatched confirmation may settle late', async () => {
    const late = await fixture();
    const delayed = await fixture();
    const budget = { executionMs: 300, finalizationMs: 1000, expiryMarginMs: 1000, lifetimeMs: 4000 };
    for (const fixture of [late, delayed]) {
      Object.assign(fixture.configuration.resourcePolicies[0].policy, { reservationBudget: budget });
    }

    // Advance application time at causal boundaries while keeping SDK and socket timers real.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      late.outcome(async () => {
        vi.setSystemTime(Date.now() + budget.executionMs + 1);
        return { status: 'succeeded', result: { answer: 'too late' } };
      });
      expect((await late.execute('late-compute')).billing).toMatchObject({
        executionStatus: 'failed',
        settlementStatus: 'released',
        billedUnits: 0,
      });
      expect(late.computes()).toBe(1);
      expect(
        late.requests.filter(value => value.path === '/v1/balances.finalize').map(value => value.body.action),
      ).toEqual(['release']);
      expect(late.behavior.balance).toBe(10);

      const remoteExpiry = Date.now() + budget.lifetimeMs;
      let confirmationReceivedAt: number | undefined;
      delayed.behavior.dropFinalize = true;
      delayed.behavior.visibleLogs = false;
      delayed.hooks.beforeFinalize = async () => {
        // The provider has received the request, but has yet to apply the confirmation.
        confirmationReceivedAt = Date.now();
        vi.setSystemTime(remoteExpiry + 1);
      };
      const pending = await delayed.execute('late-settlement');
      expect(pending.billing).toMatchObject({
        executionStatus: 'completed',
        settlementStatus: 'pending',
        billedUnits: null,
      });
      const stored = (
        await delayed.observer.execute({
          sql: 'SELECT request, terminal_dispatched FROM billing_remote_operations WHERE execution_id = ?',
          args: [pending.billing.executionId],
        })
      ).rows[0];
      const reservation = JSON.parse(String(stored.request));
      expect(stored.terminal_dispatched).toBe(1n);
      expect(confirmationReceivedAt).toBeLessThan(reservation.confirmationCutoff);
      expect(Date.parse(String(delayed.logs[0].timestamp))).toBeGreaterThan(reservation.expiresAt);
      expect(delayed.behavior.balance).toBe(7);

      await delayed.restart();
      await delayed.storage().recoverFinancial();
      expect((await delayed.read(pending.billing.executionId)).billing).toMatchObject({
        executionStatus: 'completed',
        settlementStatus: 'pending',
        billedUnits: null,
      });
      delayed.behavior.visibleLogs = true;
      await delayed.storage().recoverFinancial();
      expect((await delayed.read(pending.billing.executionId)).billing).toMatchObject({
        executionStatus: 'completed',
        settlementStatus: 'settled',
        billedUnits: 3,
      });
      expect(delayed.computes()).toBe(1);
      expect(delayed.requests.filter(value => value.path === '/v1/balances.finalize').map(value => value.body)).toEqual(
        [{ customer_id: 'johns-org', lock_id: reservation.id, action: 'confirm', override_value: 3 }],
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it('Autumn resume replay and conflict leave the winning execution deadline unchanged', async () => {
    const f = await nativeFixture({ workflowAfterPrompt: '[abort] hold the resumed model' });
    const run = await f.runtime.billing
      .workflow('report')
      .createRun({ billing: f.context, idempotencyKey: 'deadline-race' });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const startedAt = Date.now();
      const suspended = await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
      const projection = suspended.kind === 'immediate' ? suspended.projection : suspended.result;
      expect(projection.expiresAt).toBe(startedAt + 1_800_000);
      const approval = {
        billing: f.context,
        idempotencyKey: 'approve',
        step: 'approval',
        resumeData: { approved: true },
      } as const;
      const pending = run.resume(approval);
      await f.model.stallStarted;
      const original = (await f.observer.execute('SELECT segment_deadline FROM billing_remote_operations')).rows[0]
        .segment_deadline;
      vi.setSystemTime(Date.now() + 60_000);
      try {
        expect((await run.resume(approval)).kind).toBe('replay');
        await expect(run.resume({ ...approval, idempotencyKey: 'different' })).rejects.toMatchObject({
          code: 'conflict',
        });
      } finally {
        vi.setSystemTime(Number(original) + 1);
        f.model.release();
      }
      const late = await pending;
      expect(late.billing).toMatchObject({ executionStatus: 'failed', settlementStatus: 'released', billedUnits: 0 });
      expect(
        (await f.observer.execute('SELECT segment_deadline FROM billing_remote_operations')).rows[0].segment_deadline,
      ).toBe(original);
      expect(f.model.requests).toHaveLength(2);
      expect(
        f.requests.filter(value => value.path === '/v1/balances.finalize').map(value => value.body.action),
      ).toEqual(['release']);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['after-claim', 'after-preparation'] as const)(
    'Autumn resume expires %s before native dispatch and releases once',
    async boundary => {
      const f = await nativeFixture();
      const run = await f.runtime.billing
        .workflow('report')
        .createRun({ billing: f.context, idempotencyKey: boundary });
      await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
      const approval = {
        billing: f.context,
        idempotencyKey: 'approve',
        step: 'approval',
        resumeData: { approved: true },
      } as const;
      vi.useFakeTimers({ toFake: ['Date'] });
      const expire = () => vi.setSystemTime(Date.now() + 120_001);
      // Both barriers retain the real SQL claim and native snapshot preparation.
      // Advance time only after the selected boundary returns.
      const claim = f.runtime.workflowStorage.claim.bind(f.runtime.workflowStorage);
      const createRun = f.runtime.workflows.report.native.createRun.bind(f.runtime.workflows.report.native);
      const barrier =
        boundary === 'after-claim'
          ? vi.spyOn(f.runtime.workflowStorage, 'claim').mockImplementation(async (...args) => {
              const result = await claim(...args);
              if (result.claimed && args[2] === 'resume') expire();
              return result;
            })
          : vi.spyOn(f.runtime.workflows.report.native, 'createRun').mockImplementation(async (...args) => {
              const result = await createRun(...args);
              expire();
              return result;
            });
      try {
        const expired = await run.resume(approval);
        expect(expired.billing).toMatchObject({
          executionStatus: 'failed',
          settlementStatus: 'released',
          billedUnits: 0,
        });
        expect(await run.resume(approval)).toMatchObject({
          kind: 'replay',
          result: { status: 'failed' },
          billing: { billedUnits: 0 },
        });
        expect(f.model.requests).toHaveLength(1);
        const steps = (await readFile(join(f.database.directory, 'workflow-events.jsonl'), 'utf8'))
          .trim()
          .split('\n')
          .map(line => JSON.parse(line));
        expect(steps).toEqual([{ step: 'before' }]);
        expect(
          f.requests.filter(value => value.path === '/v1/balances.finalize').map(value => value.body.action),
        ).toEqual(['release']);
        expect(f.behavior.balance).toBe(10);
      } finally {
        barrier.mockRestore();
        vi.useRealTimers();
      }
    },
  );

  it.each(['agent', 'workflow'] as const)(
    'Autumn aborts a stalled %s and releases its acknowledged hold at the active deadline',
    async kind => {
      const executionMs = 1500;
      const f = await nativeFixture({
        paidAgent: true,
        executionMs,
        workflowAfterPrompt: '[abort] stall after approval',
      });
      const run = await f.runtime.billing
        .workflow('report')
        .createRun({ billing: f.context, idempotencyKey: 'active-budget' });
      if (kind === 'workflow')
        await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
      const invoke = () =>
        kind === 'agent'
          ? f.runtime.billing
              .agent('assistant')
              .generate('[abort] stall the model', { billing: f.context, idempotencyKey: 'stall' })
          : run.resume({
              billing: f.context,
              idempotencyKey: 'approve',
              step: 'approval',
              resumeData: { approved: true },
            });
      const lostRelease = kind === 'workflow';
      f.behavior.dropFinalize = lostRelease;
      f.behavior.visibleLogs = !lostRelease;
      const pending = invoke();
      try {
        // A real HTTP socket must close after the active budget. The watchdog
        // releases the mock model on regressions so the test can assert the cause.
        const started = await Promise.race([f.model.stallStarted.then(() => true), pending.then(() => false)]);
        expect(started).toBe(true);
        const aborted = await Promise.race([
          f.model.stallAborted.then(() => true),
          delay(executionMs + 1000, false, { ref: false }),
        ]);
        f.model.release();
        const result = await pending;
        if (result.kind === 'nested') throw new Error('Expected an independent billed execution.');
        expect(aborted).toBe(true);
        expect(result.billing).toMatchObject({
          executionStatus: 'failed',
          settlementStatus: lostRelease ? 'pending' : 'released',
          billedUnits: lostRelease ? null : 0,
        });
        const executionId = result.billing!.executionId;
        await f.runtime.accounting.capture(executionId, [{ id: 'late-observation', measure: 'tokens', units: 1 }]);
        expect(
          (await f.observer.execute("SELECT id FROM billing_measurements WHERE id = 'late-observation'")).rows,
        ).toEqual([]);
        expect(await invoke()).toMatchObject({
          kind: 'replay',
          billing: { executionStatus: 'failed', billedUnits: lostRelease ? null : 0 },
        });
        const effects = () =>
          f.requests.filter(value => value.path === '/v1/balances.finalize').map(value => value.body.action);
        expect(effects()).toEqual(['release']);
        expect(f.behavior.balance).toBe(10);
        expect(f.locks.size).toBe(0);
        if (lostRelease) {
          const originalIntent = async () =>
            (
              await f.observer.execute({
                sql: 'SELECT terminal_payload, terminal_dispatched FROM billing_remote_operations WHERE execution_id = ?',
                args: [executionId],
              })
            ).rows[0];
          const intent = await originalIntent();
          expect(intent.terminal_dispatched).toBe(1n);
          expect(JSON.parse(String(intent.terminal_payload))).toMatchObject({
            customerId: 'johns-org',
            request: { action: 'release', units: 0 },
          });
          f.behavior.visibleLogs = true;
          await f.restart({
            ...f.options.bindings,
            customers: f.options.bindings.customers.map(customer => ({
              ...customer,
              customerId: 'different-customer',
            })),
          });
          const requests = f.requests.length;
          await f.storage().recoverFinancial();
          expect(f.requests).toHaveLength(requests);
          expect((await f.read(executionId)).billing).toMatchObject({ settlementStatus: 'pending', billedUnits: null });

          f.behavior.visibleLogs = false;
          await f.restart();
          await f.storage().recoverFinancial();
          expect((await f.read(executionId)).billing).toMatchObject({ settlementStatus: 'pending', billedUnits: null });
          f.behavior.visibleLogs = true;
          await f.storage().recoverFinancial();
          expect((await f.read(executionId)).billing).toMatchObject({ settlementStatus: 'released', billedUnits: 0 });
          expect(await originalIntent()).toEqual(intent);
        }
        expect(f.model.requests).toHaveLength(kind === 'agent' ? 1 : 2);
        expect(effects()).toEqual(['release']);
      } finally {
        f.model.release();
      }
    },
  );

  it('Autumn expiry fences a detached workflow step that ignores cancellation', async () => {
    let enter!: () => void;
    let release!: () => void;
    let complete!: (outcome: string) => void;
    const entered = new Promise<void>(resolve => {
      enter = resolve;
    });
    const pause = new Promise<void>(resolve => {
      release = resolve;
    });
    const completion = new Promise<string>(resolve => {
      complete = resolve;
    });
    const f = await nativeFixture({
      executionMs: 1500,
      workflowAfterBoundary: async invoke => {
        enter();
        await pause;
        try {
          await invoke();
          complete('computed');
        } catch {
          complete('fenced');
        }
      },
    });
    const run = await f.runtime.billing
      .workflow('report')
      .createRun({ billing: f.context, idempotencyKey: 'detached' });
    await run.start({ billing: f.context, idempotencyKey: 'start', inputData: { count: 0 } });
    const approval = {
      billing: f.context,
      idempotencyKey: 'approve',
      step: 'approval',
      resumeData: { approved: true },
    } as const;
    let nativeFinished: Promise<unknown> | undefined;
    const createRun = f.runtime.workflows.report.native.createRun.bind(f.runtime.workflows.report.native);
    const observe = vi.spyOn(f.runtime.workflows.report.native, 'createRun').mockImplementation(async (...args) => {
      const native = await createRun(...args);
      const resume = native.resume.bind(native);
      vi.spyOn(native, 'resume').mockImplementationOnce((...input) => {
        const result = resume(...input);
        nativeFinished = result.catch(() => undefined);
        return result;
      });
      return native;
    });
    const pending = run.resume(approval);
    try {
      await entered;
      expect((await pending).billing).toMatchObject({
        executionStatus: 'failed',
        settlementStatus: 'released',
        billedUnits: 0,
      });
      release();
      expect(await completion).toBe('fenced');
      expect((await run.resume(approval)).billing).toMatchObject({
        executionStatus: 'failed',
        settlementStatus: 'released',
        billedUnits: 0,
      });
      expect(f.model.requests).toHaveLength(1);
      expect(
        f.requests.filter(request => request.path === '/v1/balances.finalize').map(request => request.body.action),
      ).toEqual(['release']);
    } finally {
      release();
      await nativeFinished;
      observe.mockRestore();
    }
  });

  it('financial recovery reaches matching Autumn evidence past a full unresolved batch', async () => {
    const f = await fixture();
    f.behavior.balance = 1000;
    for (let index = 0; index < 101; index++) {
      f.behavior.dropFinalize = true;
      expect((await f.execute(`unacknowledged-${index}`)).billing).toMatchObject({
        settlementStatus: 'pending',
        billedUnits: null,
      });
    }
    const operations = (
      await f.observer.execute('SELECT execution_id, request FROM billing_remote_operations ORDER BY execution_id')
    ).rows;
    const target = operations.at(-1)!;
    const lockId = JSON.parse(String(target.request)).id;
    const evidence = f.logs.find(log => (log.request_body as { lock_id: string }).lock_id === lockId)!;
    f.logs.splice(0, f.logs.length, evidence);
    await f.restart();
    await f.storage().recoverFinancial();
    expect((await f.read(String(target.execution_id))).billing.billedUnits).toBeNull();
    await f.storage().recoverFinancial();
    expect((await f.read(String(target.execution_id))).billing).toMatchObject({
      settlementStatus: 'settled',
      billedUnits: 3,
    });
    expect(
      (
        await f.observer.execute(
          "SELECT COUNT(*) AS pending FROM billing_executions WHERE settlement = 'pending' AND billed_units IS NULL",
        )
      ).rows,
    ).toEqual([{ pending: 100n }]);
    expect(f.requests.filter(value => value.path === '/v1/balances.finalize')).toHaveLength(101);
    expect(f.computes()).toBe(101);
    expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
  }, 30_000);

  it('configured application and Hono preserve Autumn authentication payer isolation and account evidence', async () => {
    const f = await fixture();
    const model = await modelBoundary();
    cleanups.push(model.close);
    const returnUrl = 'https://app.example.test/billing';
    const unboundReturnUrl = 'https://app.example.test/other';
    const configuration = {
      ...f.configuration,
      hosted: { returnUrls: [returnUrl, unboundReturnUrl] },
      catalog: {
        ...f.configuration.catalog,
        offers: [
          ...f.configuration.catalog.offers,
          { key: 'unbound-offer', version: 'v1', allowances: [], entitlements: [], subscriptions: [] },
        ],
      },
      resourcePolicies: [
        {
          id: 'weather-agent',
          kind: 'agent',
          operations: ['generate'],
          policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
        },
        {
          id: 'weather-report',
          kind: 'workflow',
          operations: ['start', 'resume', 'cancel'],
          policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 2 } },
        },
      ],
    };
    const environment = {
      BILLING_PROVIDER: 'autumn',
      BILLING_MODE: 'production',
      BILLING_IDENTITY_CONFIG_FILE: configurationFile(f.database.directory, f.jwtConfiguration),
      BILLING_DATABASE_URL: f.database.url,
      BILLING_PROJECT_ROOT: f.database.directory,
      BILLING_CONFIG_FILE: configurationFile(f.database.directory, configuration),
      OPENAI_BASE_URL: model.url,
      OPENAI_API_KEY: 'controlled',
    };
    const serve = async (bindings = f.options.bindings) => {
      const { resourcePolicies: policies, ...billingConfiguration } = configuration;
      const resources = weatherDefinitions(environment).map(definition => ({
        ...definition,
        measurements: [],
        policy: billingPolicySchema.parse(policies.find(policy => policy.id === definition.id)!.policy),
      }));
      const application = await createBillingApplication({
        environment: {
          ...environment,
          AUTUMN_SECRET_KEY: f.options.secretKey,
          AUTUMN_CONFIG_FILE: configurationFile(f.database.directory, bindings),
          AUTUMN_SERVER_URL: f.options.serverURL,
        },
        catalog: { definitions: resources, configuration: billingConfiguration },
      });
      cleanups.push(application.close);
      const server = await billingSocket(
        createBillingApp({
          organizations: application.organizations,
          execution: application.execution,
          commercial: application.runtime.commercial,
        }),
      );
      cleanups.push(server.close);
      return server.url;
    };
    const serverUrl = await serve();
    const base = `${serverUrl}/billing/workspaces/${f.owner.workspaceId}`;
    expect((await fetch(`${base}/usage`)).status).toBe(401);
    const headers = {
      authorization: `Bearer ${f.owner.credential}`,
      'content-type': 'application/json',
      'idempotency-key': 'configured-paid',
    };
    const prompt = JSON.stringify({
      observations: {
        location: 'Campinas',
        observedAt: '2026-11-10T10:00:00Z',
        temperatureC: 24,
        feelsLikeC: 25,
        humidityPercent: 60,
        windKph: 10,
        precipitationChancePercent: 20,
        conditions: 'Cloudy',
      },
      purpose: 'summary',
    });
    const generated = await fetch(`${base}/agents/weather-agent/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    expect(generated.status).toBe(200);
    expect(await generated.json()).toMatchObject({
      billing: { billedUnits: 3, settlementStatus: 'settled' },
      result: { text: 'ok' },
    });
    const account = await fetch(`${base}/usage`, { headers });
    expect(await account.json()).toMatchObject({
      authority: 'provider-reservations',
      pendingOperations: [],
      meters: [{ confirmedBalance: 7, consumedUnits: null, providerUsageIncludingHolds: 3 }],
    });
    const forged = await fetch(`${serverUrl}/billing/workspaces/foreign-workspace/agents/weather-agent/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    expect(forged.status).toBe(403);
    expect(model.requests).toHaveLength(1);
    expect(f.requests.filter(value => value.body.lock)).toHaveLength(1);

    const member = await f.profile('hosted-member');
    await f.organizations.convert(f.context, 'share-hosted-workspace');
    const invitation = await f.organizations.invite(f.context, 'invite-hosted-member', {
      recipientId: member.identity.id,
      role: 'member',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await f.organizations.acceptInvitation({
      credential: member.credential,
      key: 'join-hosted-workspace',
      token: invitation.token!,
    });
    const hosted = (operation: 'checkout' | 'portal', key: string, input: object, credential?: string, target = base) =>
      fetch(`${target}/${operation}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': key,
          ...(credential ? { authorization: `Bearer ${credential}` } : {}),
        },
        body: JSON.stringify(input),
      });
    const effects = () => f.requests.filter(request => request.path.startsWith('/v1/billing.'));
    const pack = { product: 'credit-pack', returnUrl };
    expect((await hosted('checkout', 'anonymous-checkout', pack)).status).toBe(401);
    expect((await hosted('portal', 'anonymous-portal', { returnUrl })).status).toBe(401);
    expect((await hosted('checkout', 'member-checkout', pack, member.credential)).status).toBe(403);
    expect((await hosted('portal', 'member-portal', { returnUrl }, member.credential)).status).toBe(403);
    expect(
      (await hosted('checkout', 'unknown-offer', { ...pack, product: 'unknown-offer' }, f.owner.credential)).status,
    ).toBe(400);
    expect(
      (await hosted('checkout', 'unbound-offer', { ...pack, product: 'unbound-offer' }, f.owner.credential)).status,
    ).toBe(403);
    expect(
      (
        await hosted(
          'checkout',
          'wrong-return',
          { ...pack, returnUrl: 'https://outside.example.test/billing' },
          f.owner.credential,
        )
      ).status,
    ).toBe(400);
    expect((await hosted('portal', 'unbound-return', { returnUrl: unboundReturnUrl }, f.owner.credential)).status).toBe(
      403,
    );
    expect(effects()).toEqual([]);

    const checkout = await hosted('checkout', 'owner-checkout', pack, f.owner.credential);
    expect(checkout.status).toBe(200);
    expect(await checkout.json()).toEqual({ status: 'created', url: f.behavior.checkoutUrl });
    const portal = await hosted('portal', 'owner-portal', { returnUrl }, f.owner.credential);
    expect(portal.status).toBe(200);
    expect(await portal.json()).toEqual({ status: 'created', url: f.behavior.portalUrl });
    const replay = await hosted('checkout', 'owner-checkout', pack, f.owner.credential);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ status: 'created', url: f.behavior.checkoutUrl });
    expect(effects()).toEqual([
      {
        path: '/v1/billing.attach',
        version: '2.6.0',
        body: { customer_id: 'johns-org', plan_id: 'test-image-pack', success_url: returnUrl, redirect_mode: 'always' },
      },
      {
        path: '/v1/billing.open_customer_portal',
        version: '2.6.0',
        body: { customer_id: 'johns-org', return_url: returnUrl },
      },
    ]);
    expect(f.behavior.balance).toBe(7);

    const originalBindings = f.options.bindings;
    const drifted = await serve({
      ...originalBindings,
      customers: [{ workspaceId: f.owner.workspaceId, customerId: 'different-customer' }],
    });
    const reassigned = await serve({
      ...originalBindings,
      customers: [{ workspaceId: member.workspaceId, customerId: 'johns-org' }],
    });
    const changedPlan = await serve({ ...originalBindings, plans: [{ key: 'credit-pack', planId: 'different-plan' }] });
    const beforeDrift = f.requests.length;
    expect
      .soft(
        (
          await hosted(
            'portal',
            'owner-portal',
            { returnUrl },
            f.owner.credential,
            `${drifted}/billing/workspaces/${f.owner.workspaceId}`,
          )
        ).status,
      )
      .toBe(409);
    expect
      .soft(
        (
          await hosted(
            'portal',
            'new-owner',
            { returnUrl },
            member.credential,
            `${reassigned}/billing/workspaces/${member.workspaceId}`,
          )
        ).status,
      )
      .toBe(409);
    expect.soft(f.requests).toHaveLength(beforeDrift);
    expect
      .soft(
        (
          await hosted(
            'checkout',
            'owner-checkout',
            pack,
            f.owner.credential,
            `${changedPlan}/billing/workspaces/${f.owner.workspaceId}`,
          )
        ).status,
      )
      .toBe(409);
    const restored = await serve();
    const restoredReplay = await hosted(
      'portal',
      'owner-portal',
      { returnUrl },
      f.owner.credential,
      `${restored}/billing/workspaces/${f.owner.workspaceId}`,
    );
    expect(restoredReplay.status).toBe(200);
    expect(await restoredReplay.json()).toEqual({ status: 'created', url: f.behavior.portalUrl });
    expect(effects()).toHaveLength(2);
  });
});

it('cached checkout and portal URLs stay private when permission is revoked after either cache lookup', async () => {
  for (const operation of ['checkout', 'portal'] as const) {
    for (const boundary of ['claim', 'dispatch'] as const) {
      const f = await fixture();
      const storage = await CommercialStorage.open({ url: f.database.url }, f.organizations.storage);
      cleanups.push(async () => storage.close());
      const service = new CommercialService(f.organizations, storage, f.provider(), f.configuration);
      const input = {
        returnUrl: 'https://app.example.test/billing',
        ...(operation === 'checkout' ? { product: 'credit-pack' } : {}),
      };
      expect(await service[operation](f.context, 'cached-session', input)).toMatchObject({ status: 'created' });
      const original = storage[boundary].bind(storage);
      // Real transactions finish before this concurrent membership change commits.
      const intercepted = vi.spyOn(storage, boundary).mockImplementation(async (...args) => {
        const result = await original(...args);
        await f.observer.execute({
          sql: "UPDATE memberships SET role = 'member' WHERE identity_id = ? AND workspace_id = ?",
          args: [f.context.actorId, f.context.workspaceId],
        });
        return result;
      });
      if (boundary === 'dispatch') {
        const claim = storage.claim.bind(storage);
        vi.spyOn(storage, 'claim').mockImplementation(async (...args) => {
          const result = await claim(...args);
          // Another authorized request completes the operation between claim and dispatch.
          if (result.claimed) {
            await original(...args);
            await storage.complete(
              args[0],
              operation,
              args[2],
              operation === 'checkout' ? f.behavior.checkoutUrl : f.behavior.portalUrl,
            );
          }
          return result;
        });
      }
      await expect(
        service[operation](f.context, boundary === 'dispatch' ? 'concurrent-session' : 'cached-session', input),
      ).rejects.toMatchObject({ code: 'forbidden' });
      intercepted.mockRestore();
      expect(
        f.requests.filter(request => ['/v1/billing.attach', '/v1/billing.open_customer_portal'].includes(request.path)),
      ).toHaveLength(1);
    }
  }
});

it.each(['checkout', 'portal'] as const)(
  'prepared %s dispatch keeps the validated return URL after caller mutation',
  async operation => {
    const f = await fixture();
    const account = await f.provider().ensureAccount({ workspaceId: f.context.workspaceId });
    const request = { account, product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
    const prepared = await (operation === 'checkout'
      ? f.provider().prepareCheckout(request)
      : f.provider().preparePortalSession(request));
    if (prepared.status !== 'prepared') throw new Error('Expected a prepared session');
    request.returnUrl = 'https://untrusted.example/steal-session';
    expect(await prepared.dispatch()).toMatchObject({ status: 'created' });
    const sent = f.requests.findLast(
      value => value.path === (operation === 'checkout' ? '/v1/billing.attach' : '/v1/billing.open_customer_portal'),
    )!;
    expect(sent.body[operation === 'checkout' ? 'success_url' : 'return_url']).toBe('https://app.example.test/billing');
  },
);

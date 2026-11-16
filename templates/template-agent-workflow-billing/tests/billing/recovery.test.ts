import { removeDeliveryQueueMigration } from '../support/billing.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { RecoveryStorage, deliveryQueueQuery } from '../../src/billing/storage/recovery.js';
import { BillingRecovery } from '../../src/billing/runtime/recovery.js';
import { BillingDatabase } from '../../src/billing/storage/database.js';
import { modelBoundary, runtimeFixture, operationBarrier } from '../support/mastra.js';
import { independentClient, temporaryDatabase } from '../support/billing.js';

const cleanups: (() => void | Promise<void>)[] = [];
function forkWorker(...args: Parameters<typeof fork>) {
  const child = fork(...args);
  cleanups.push(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
  });
  return child;
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
describe('durable billing recovery', () => {
  it('metered outbox survives a receiver commit and lost acknowledgement without repeated consumption', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const model = await modelBoundary();
    cleanups.push(model.close);
    const initial = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
    });
    cleanups.push(initial.close);
    const result = await initial.billing.http.generate(
      'assistant',
      '[success] metered summary',
      initial.billingContext,
      'metered-summary',
    );
    expect(result.billing).toMatchObject({ executionStatus: 'completed', billedUnits: 5, deliveryStatus: 'pending' });
    const observer = await independentClient(database.url);
    cleanups.push(() => observer.close());
    const outbox = (await observer.execute('SELECT id, payload FROM billing_outbox')).rows;
    expect(outbox).toHaveLength(1);
    expect((await observer.execute("SELECT consumed FROM commercial_meters WHERE key = 'tokens'")).rows).toEqual([
      { consumed: 0n },
    ]);
    const ledger = (await observer.execute('SELECT * FROM billing_ledger')).rows;
    const reopen = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: initial.credential,
      workspaceId: initial.billingContext.workspaceId,
      configuration: initial.configuration,
    };
    await initial.close();
    const child = forkWorker(
      fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
      ['metered-delivery', JSON.stringify(reopen)],
      { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    const [committed] = await once(child, 'message');
    expect(committed).toMatchObject({
      boundary: 'metered-committed',
      status: 'accepted',
      id: outbox[0].id,
      payload: outbox[0].payload,
    });
    const exiting = once(child, 'exit');
    child.kill('SIGKILL');
    await exiting;
    expect((await observer.execute('SELECT id, payload FROM immutable_usage')).rows).toEqual(outbox);
    const restarted = await runtimeFixture(reopen);
    cleanups.push(restarted.close);
    const records = await RecoveryStorage.open({ url: database.url });
    cleanups.push(() => records.close());
    const recovery = new BillingRecovery(records, restarted.provider);
    cleanups.push(() => recovery.stop());
    await setTimeout(120);
    await recovery.runOnce();
    await recovery.runOnce();
    expect((await observer.execute('SELECT status, attempts FROM billing_delivery')).rows).toEqual([
      { status: 'accepted', attempts: 2n },
    ]);
    expect((await observer.execute('SELECT id, payload FROM immutable_usage')).rows).toEqual(outbox);
    expect((await observer.execute('SELECT * FROM billing_ledger')).rows).toEqual(ledger);
    expect((await observer.execute("SELECT consumed FROM commercial_meters WHERE key = 'tokens'")).rows).toEqual([
      { consumed: 5n },
    ]);
    expect(
      (
        await restarted.billing.http.generate(
          'assistant',
          '[success] metered summary',
          restarted.billingContext,
          'metered-summary',
        )
      ).billing,
    ).toMatchObject({
      executionId: result.billing.executionId,
      billedUnits: 5,
      replayed: true,
      deliveryStatus: 'accepted',
    });
    expect(model.requests).toHaveLength(1);
  }, 30000);

  it.each(['initial-acknowledged', 'initial-handoff', 'adopted'] as const)(
    'startup respects the durable workflow boundary after interruption at %s',
    async boundary => {
      const database = await temporaryDatabase();
      cleanups.push(database.cleanup);
      const model = await modelBoundary();
      cleanups.push(model.close);
      const base = { databaseUrl: database.url, directory: database.directory, modelUrl: model.url };
      const initial = await runtimeFixture(base);
      const options = {
        ...base,
        credential: initial.credential,
        workspaceId: initial.billingContext.workspaceId,
        configuration: initial.configuration,
      };
      await initial.close();
      const child = forkWorker(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [boundary === 'adopted' ? 'initial-acknowledged' : boundary, JSON.stringify(options)],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      const [execution] = (await once(child, 'message')) as [{ executionId: string; boundary: string }];
      expect(execution.boundary).toBe(boundary === 'adopted' ? 'initial-acknowledged' : boundary);
      const observer = await independentClient(database.url);
      cleanups.push(() => observer.close());
      const claimed = boundary === 'initial-handoff';
      expect(
        (await observer.execute('SELECT reserve_state, segment_deadline FROM billing_remote_operations')).rows,
      ).toEqual([{ reserve_state: 'reserved', segment_deadline: claimed ? expect.any(BigInt) : null }]);
      const records = await RecoveryStorage.open({ url: database.url });
      cleanups.push(() => records.close());
      expect(await records.recoverInterrupted()).toBe(0);
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
      const restarted = await runtimeFixture(options);
      cleanups.push(restarted.close);
      const recovery = new BillingRecovery(records, restarted.provider, () => restarted.accounting.recoverFinancial());
      cleanups.push(() => recovery.stop());
      const handle = await restarted.billing
        .workflow('report')
        .getRun({ billing: restarted.billingContext, executionId: execution.executionId });

      if (boundary === 'adopted') {
        const selected = operationBarrier();
        const write = BillingDatabase.prototype.write;
        const recordsDatabase = (records as unknown as { database: BillingDatabase }).database;
        let paused = false;
        const observe = vi.spyOn(BillingDatabase.prototype, 'write');
        observe.mockImplementation(async function (this: BillingDatabase, work) {
          const result = await write.call(this, work);
          if (this === recordsDatabase && !paused) {
            paused = true;
            await selected.pause();
          }
          return result;
        });
        const recovering = recovery.runOnce();
        try {
          await selected.entered;
          const tx = await observer.transaction('write');
          try {
            await tx.execute({
              sql: 'INSERT INTO billing_runtimes VALUES (?, ?)',
              args: ['live-adopted-owner', process.pid],
            });
            await tx.execute({
              sql: 'UPDATE billing_workflow_runs SET owner = ? WHERE id = ?',
              args: ['live-adopted-owner', execution.executionId],
            });
            await tx.commit();
          } finally {
            tx.close();
          }
          selected.release();
          await recovering;
          // A later scan must also respect the live workflow owner even while
          // the execution still names the original, dead runtime.
          await recovery.runOnce();
          expect((await handle.status(restarted.billingContext)).billing).toMatchObject({
            executionStatus: 'running',
            settlementStatus: 'reserved',
            billedUnits: null,
          });
          expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
        } finally {
          selected.release();
          await recovering.catch(() => {});
          observe.mockRestore();
        }
      } else await recovery.runOnce();

      await recovery.runOnce();
      const canceled = await handle.cancel({
        billing: restarted.billingContext,
        idempotencyKey: 'cancel-after-restart',
      });
      expect(canceled.billing).toMatchObject(
        claimed
          ? { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null }
          : {
              executionStatus: boundary === 'adopted' ? 'canceled' : 'failed',
              settlementStatus: 'released',
              billedUnits: 0,
            },
      );
      expect(model.requests).toHaveLength(0);
      expect((await observer.execute('SELECT state FROM local_provider_reservations')).rows).toEqual([
        { state: claimed ? 'reserved' : 'released' },
      ]);
      expect((await observer.execute('SELECT units FROM billing_ledger')).rows).toEqual(claimed ? [] : [{ units: 0n }]);
    },
  );

  it('restart recovery preserves uncertain work and expires confirmed suspended runs', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const model = await modelBoundary();
    cleanups.push(model.close);
    const initial = await runtimeFixture({
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
    });
    const options = {
      databaseUrl: database.url,
      directory: database.directory,
      modelUrl: model.url,
      credential: initial.credential,
      workspaceId: initial.billingContext.workspaceId,
      configuration: initial.configuration,
      workflowPrompt: '[abort] interrupted workflow',
    };
    await initial.close();
    const observer = await independentClient(database.url);
    cleanups.push(() => observer.close());
    const records = await RecoveryStorage.open({ url: database.url });
    cleanups.push(() => records.close());
    const ids: string[] = [];
    for (const kind of ['agent', 'workflow']) {
      const requests = model.requests.length;
      const child = forkWorker(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [kind, JSON.stringify(options)],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      let diagnostics = '';
      child.stderr?.on('data', chunk => {
        diagnostics = (diagnostics + chunk).slice(-4000);
      });
      for (let attempt = 0; attempt < 1000 && model.requests.length === requests; attempt++) {
        if (child.exitCode !== null) throw new Error(diagnostics);
        await setTimeout(5);
      }
      expect(model.requests).toHaveLength(requests + 1);
      const row = (
        await observer.execute(
          "SELECT id FROM billing_executions WHERE status = 'running' ORDER BY created_at DESC LIMIT 1",
        )
      ).rows[0];
      ids.push(String(row.id));
      expect(await records.recoverInterrupted()).toBe(0); // A live process owns it.
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
      expect(await records.recoverInterrupted()).toBe(1);
    }

    const orphan = forkWorker(
      fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
      ['orphan', JSON.stringify(options)],
      { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    const [orphanClaim] = (await once(orphan, 'message')) as [{ executionId: string }];
    expect(await records.recoverInterrupted()).toBe(0);
    const orphanExit = once(orphan, 'exit');
    orphan.kill('SIGKILL');
    await orphanExit;
    expect(await records.recoverInterrupted()).toBe(1);
    expect(
      (
        await observer.execute({
          sql: 'SELECT status FROM billing_workflow_runs WHERE id = ?',
          args: [orphanClaim.executionId],
        })
      ).rows,
    ).toEqual([{ status: 'uncertain' }]);
    expect(
      (
        await observer.execute({
          sql: 'SELECT id FROM billing_executions WHERE id = ?',
          args: [orphanClaim.executionId],
        })
      ).rows,
    ).toEqual([]);
    expect(
      (
        await observer.execute({
          sql: 'SELECT execution_id FROM billing_reservations WHERE execution_id = ?',
          args: [orphanClaim.executionId],
        })
      ).rows,
    ).toEqual([]);
    const runtime = await runtimeFixture({
      ...options,
      workflowPrompt: undefined,
      workflowAfterPrompt: '[abort] resumed owner',
    });
    cleanups.push(runtime.close);
    const before = model.requests.length;
    const replay = await runtime.billing
      .agent('assistant')
      .generate('[abort] interrupted', { billing: runtime.billingContext, idempotencyKey: 'interrupted-agent' });
    expect(replay).toMatchObject({
      kind: 'replay',
      billing: { executionStatus: 'uncertain', settlementStatus: 'uncertain', billedUnits: null },
    });
    const workflow = await runtime.billing
      .workflow('report')
      .getRun({ executionId: ids[1], billing: runtime.billingContext });
    expect((await workflow.status(runtime.billingContext)).result.status).toBe('uncertain');
    await expect(
      workflow.resume({
        billing: runtime.billingContext,
        idempotencyKey: 'never-replay',
        step: 'approval',
        resumeData: { approved: true },
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    // Even a late completion with recorded-looking measurements cannot publish
    // after interrupted recovery revoked its execution/version authority.
    for (const id of ids) await runtime.accounting.capture(id, [{ id: 'late-capture', measure: 'tokens', units: 5 }]);
    for (const id of ids)
      await runtime.accounting.finish(
        id,
        {
          status: 'succeeded',
          result: { answer: 'late' },
          measurements: [{ id: 'late', measure: 'tokens', units: 5 }],
          measurementComplete: true,
        },
        { answer: 'late' },
      );
    expect((await observer.execute('SELECT execution_id FROM billing_ledger')).rows).toEqual([]);
    expect((await observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([
      { active: 1n },
      { active: 1n },
    ]);
    expect((await observer.execute('SELECT id FROM billing_measurements')).rows).toEqual([]);
    expect(model.requests).toHaveLength(before);

    const suspendedChild = forkWorker(
      fileURLToPath(new URL('../support/mastra-worker.mjs', import.meta.url)),
      [
        'start',
        JSON.stringify({ ...options, workflowPrompt: undefined, workflowAfterPrompt: '[abort] resumed owner' }),
        'new-owner',
      ],
      { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    let suspendedId = '';
    suspendedChild.on('message', (value: any) => {
      suspendedId = value.executionId;
    });
    const [suspensionCode] = await once(suspendedChild, 'exit');
    expect(suspensionCode).toBe(0);
    expect(await records.recoverInterrupted()).toBe(0);
    const activeHandle = await runtime.billing
      .workflow('report')
      .getRun({ executionId: suspendedId, billing: runtime.billingContext });
    const resuming = activeHandle.resume({
      billing: runtime.billingContext,
      idempotencyKey: 'active-new-owner',
      step: 'approval',
      resumeData: { approved: true },
    });
    for (let attempt = 0; attempt < 1000 && model.requests.length < before + 2; attempt++) await setTimeout(5);
    expect(model.requests).toHaveLength(before + 2);
    expect(await records.recoverInterrupted()).toBe(0);
    model.release();
    expect((await resuming).billing).toMatchObject({
      executionStatus: 'completed',
      billedUnits: 2,
      settlementStatus: 'settled',
    });
    const afterActiveResume = model.requests.length;

    // Reopen real suspended Mastra snapshots, then race expiry against resume
    // twenty times using independent runtime connections.
    const expiryIds: string[] = [];
    for (let round = 0; round < 20; round++) {
      if (round === 0) {
        const child = forkWorker(
          fileURLToPath(new URL('../support/mastra-worker.mjs', import.meta.url)),
          ['start', JSON.stringify({ ...options, workflowPrompt: undefined })],
          { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
        );
        let result: any;
        child.on('message', value => {
          result = value;
        });
        const [code] = await once(child, 'exit');
        expect(code).toBe(0);
        expect(result.billing.settlementStatus).toBe('reserved');
        expiryIds.push(result.executionId);
        expect(await records.recoverInterrupted()).toBe(0);
        expect(
          (
            await observer.execute({
              sql: 'SELECT status, recovery_fenced FROM billing_executions WHERE id = ?',
              args: [result.executionId],
            })
          ).rows,
        ).toEqual([{ status: 'running', recovery_fenced: 0n }]);
        continue;
      }
      const handle = await runtime.billing
        .workflow('report')
        .createRun({ billing: runtime.billingContext, idempotencyKey: `expiry-create-${round}` });
      await handle.start({
        billing: runtime.billingContext,
        idempotencyKey: `expiry-start-${round}`,
        inputData: { count: 0 },
      });
      expiryIds.push(handle.executionId);
    }
    const mismatch = await runtime.billing
      .workflow('report')
      .createRun({ billing: runtime.billingContext, idempotencyKey: 'mismatch' });
    await mismatch.start({
      billing: runtime.billingContext,
      idempotencyKey: 'mismatch-start',
      inputData: { count: 0 },
    });
    await (await runtime.workflows.report.native.createRun({ runId: mismatch.executionId })).cancel();
    await runtime.close();
    const fresh = await runtimeFixture({ ...options, workflowPrompt: undefined });
    cleanups.push(fresh.close);
    const other = await runtimeFixture({ ...options, workflowPrompt: undefined });
    cleanups.push(other.close);
    for (const [index, id] of expiryIds.entries()) {
      await observer.execute({ sql: 'UPDATE billing_workflow_runs SET expires_at = 0 WHERE id = ?', args: [id] });
      const handle = await other.billing.workflow('report').getRun({ executionId: id, billing: other.billingContext });
      await Promise.allSettled([
        fresh.billing.expireSuspensions(),
        other.billing.expireSuspensions(),
        handle.resume({
          billing: other.billingContext,
          idempotencyKey: `expiry-resume-${index}`,
          step: 'approval',
          resumeData: { approved: true },
        }),
      ]);
    }
    await observer.execute({
      sql: 'UPDATE billing_workflow_runs SET expires_at = 0 WHERE id = ?',
      args: [mismatch.executionId],
    });
    const worker = new BillingRecovery(records, fresh.provider, () => fresh.billing.expireSuspensions());
    cleanups.push(() => worker.stop());
    await worker.start().ready;
    expect(
      (
        await observer.execute(
          "SELECT status, COUNT(*) AS count FROM billing_workflow_runs WHERE id != 'unused' GROUP BY status ORDER BY status",
        )
      ).rows,
    ).toEqual([
      { status: 'canceled', count: 20n },
      { status: 'completed', count: 1n },
      { status: 'uncertain', count: 3n },
    ]);
    expect(
      (await observer.execute('SELECT units, COUNT(*) AS count FROM billing_ledger GROUP BY units ORDER BY units'))
        .rows,
    ).toEqual([
      { units: 0n, count: 20n },
      { units: 2n, count: 1n },
    ]);
    expect(
      (
        await observer.execute(
          'SELECT active, COUNT(*) AS count FROM billing_reservations GROUP BY active ORDER BY active',
        )
      ).rows,
    ).toEqual([
      { active: 0n, count: 21n },
      { active: 1n, count: 3n },
    ]);
    expect(model.requests).toHaveLength(afterActiveResume + 21);
    for (const id of expiryIds)
      expect((await fresh.workflows.report.native.getWorkflowRunById(id))?.status).toBe('canceled');
    expect((await observer.execute('PRAGMA foreign_key_check')).rows).toEqual([]);

    // A committed expiry claim must survive process death before runtime
    // cancellation; a compatible suspended snapshot still proves safe expiry.
    for (const phase of [
      'expiry-claimed',
      'expiry-canceled',
      'expiry-unconfirmed-canceled',
      'expiry-missing',
      'expiry-active',
    ]) {
      const boundaryDatabase = await temporaryDatabase();
      cleanups.push(boundaryDatabase.cleanup);
      const boundaryModel = await modelBoundary();
      cleanups.push(boundaryModel.close);
      const child = forkWorker(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [
          phase,
          JSON.stringify({
            databaseUrl: boundaryDatabase.url,
            directory: boundaryDatabase.directory,
            modelUrl: boundaryModel.url,
          }),
        ],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      const [committed] = (await once(child, 'message')) as [
        {
          executionId: string;
          credential: string;
          workspaceId: string;
          configuration: typeof runtime.configuration;
          checksums: { version: number; checksum: string }[];
        },
      ];
      const childExit = once(child, 'exit');
      child.kill('SIGKILL');
      await childExit;
      await setTimeout(110);
      const reopened = await runtimeFixture({
        databaseUrl: boundaryDatabase.url,
        directory: boundaryDatabase.directory,
        modelUrl: boundaryModel.url,
        credential: committed.credential,
        workspaceId: committed.workspaceId,
        configuration: committed.configuration,
      });
      cleanups.push(reopened.close);
      const records = await RecoveryStorage.open({ url: boundaryDatabase.url });
      cleanups.push(() => records.close());
      const recovery = new BillingRecovery(records, reopened.provider, () => reopened.billing.expireSuspensions());
      cleanups.push(() => recovery.stop());
      const other = await runtimeFixture({
        databaseUrl: boundaryDatabase.url,
        directory: boundaryDatabase.directory,
        modelUrl: boundaryModel.url,
        credential: committed.credential,
        workspaceId: committed.workspaceId,
        configuration: committed.configuration,
      });
      cleanups.push(other.close);
      const otherRecords = await RecoveryStorage.open({ url: boundaryDatabase.url });
      cleanups.push(() => otherRecords.close());
      const otherRecovery = new BillingRecovery(otherRecords, other.provider, () => other.billing.expireSuspensions());
      cleanups.push(() => otherRecovery.stop());
      const persisted = await independentClient(boundaryDatabase.url);
      cleanups.push(() => persisted.close());
      if (phase === 'expiry-claimed') {
        const stale = (await reopened.workflowStorage.claimExpiry(committed.executionId, Date.now(), 100))!;
        await setTimeout(110);
        const winner = (await other.workflowStorage.claimExpiry(committed.executionId, Date.now(), 100))!;
        expect(await reopened.workflowStorage.confirmExpiredSuspension(stale)).toBe(false);
        await reopened.accounting.finish(
          committed.executionId,
          { status: 'canceled', measurementComplete: false },
          null,
          { executionId: committed.executionId, version: stale.version, expiryToken: stale.expiry.token },
        );
        expect((await persisted.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
        expect((await persisted.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
        expect(winner.version).toBeGreaterThan(stale.version);
        await setTimeout(110);
      }
      await Promise.all([recovery.runOnce(), otherRecovery.runOnce()]);
      await recovery.runOnce();
      const uncertain = ['expiry-unconfirmed-canceled', 'expiry-missing', 'expiry-active'].includes(phase);
      const handle = await reopened.billing
        .workflow('report')
        .getRun({ executionId: committed.executionId, billing: reopened.billingContext });
      expect((await handle.status(reopened.billingContext)).billing, phase).toMatchObject(
        uncertain
          ? { executionStatus: 'uncertain', billedUnits: null, settlementStatus: 'uncertain' }
          : { executionStatus: 'canceled', billedUnits: 0, settlementStatus: 'released' },
      );
      const snapshot = await reopened.workflows.report.native.getWorkflowRunById(committed.executionId);
      expect(snapshot?.status, phase).toBe(
        phase === 'expiry-missing' ? undefined : phase === 'expiry-active' ? 'running' : 'canceled',
      );
      expect((await persisted.execute('SELECT active FROM billing_reservations')).rows, phase).toEqual([
        { active: uncertain ? 1n : 0n },
      ]);
      expect((await persisted.execute('SELECT units, outcome FROM billing_ledger')).rows, phase).toEqual(
        uncertain ? [] : [{ units: 0n, outcome: 'canceled' }],
      );
      expect((await persisted.execute('SELECT recovery_fenced FROM billing_executions')).rows, phase).toEqual([
        { recovery_fenced: 0n },
      ]);
      expect(boundaryModel.requests, phase).toHaveLength(1);
      expect(
        (
          await persisted.execute(
            'SELECT version, checksum FROM billing_migrations WHERE version <= 6 ORDER BY version',
          )
        ).rows.map(row => ({ version: Number(row.version), checksum: String(row.checksum) })),
      ).toEqual(committed.checksums);
    }

    // A full batch of real suspended runs with missing snapshots must not
    // starve a later run whose persisted suspension can safely expire.
    const queueDatabase = await temporaryDatabase();
    cleanups.push(queueDatabase.cleanup);
    const queueModel = await modelBoundary();
    cleanups.push(queueModel.close);
    const queueRuntime = await runtimeFixture({
      databaseUrl: queueDatabase.url,
      directory: queueDatabase.directory,
      modelUrl: queueModel.url,
      configure: configuration => {
        for (const account of configuration.localAccounts)
          for (const meter of account.meters) if (meter.key === 'tasks') meter.balance = 1000;
        return configuration;
      },
    });
    cleanups.push(queueRuntime.close);
    const queueObserver = await independentClient(queueDatabase.url);
    cleanups.push(() => queueObserver.close());
    const snapshots = (await queueRuntime.mastra.getStorage()!.getStore('workflows'))!;
    let recoverableId = '';
    for (let index = 0; index <= 100; index++) {
      const handle = await queueRuntime.billing
        .workflow('report')
        .createRun({ billing: queueRuntime.billingContext, idempotencyKey: `queue-${index}` });
      await handle.start({
        billing: queueRuntime.billingContext,
        idempotencyKey: 'queue-start',
        inputData: { count: 0 },
      });
      await queueObserver.execute({
        sql: 'UPDATE billing_workflow_runs SET expires_at = ? WHERE id = ?',
        args: [index === 100 ? 1 : 0, handle.executionId],
      });
      if (index === 100) recoverableId = handle.executionId;
      else {
        expect(await queueRuntime.workflowStorage.claimExpiry(handle.executionId, Date.now(), 100)).not.toBeNull();
        await snapshots.deleteWorkflowRunById({ runId: handle.executionId, workflowName: 'report' });
      }
    }
    await queueRuntime.close();
    const queueFresh = await runtimeFixture({
      databaseUrl: queueDatabase.url,
      directory: queueDatabase.directory,
      modelUrl: queueModel.url,
      credential: queueRuntime.credential,
      workspaceId: queueRuntime.billingContext.workspaceId,
      configuration: queueRuntime.configuration,
    });
    cleanups.push(queueFresh.close);
    await setTimeout(110);
    const queueRecords = await RecoveryStorage.open({ url: queueDatabase.url });
    cleanups.push(() => queueRecords.close());
    const queueRecovery = new BillingRecovery(queueRecords, queueFresh.provider, () =>
      queueFresh.billing.expireSuspensions(),
    );
    cleanups.push(() => queueRecovery.stop());
    await queueRecovery.runOnce();
    await queueRecovery.runOnce();
    await queueRecovery.runOnce();
    expect((await queueObserver.execute('SELECT units, outcome FROM billing_ledger')).rows).toEqual([
      { units: 0n, outcome: 'canceled' },
    ]);
    expect((await queueFresh.workflows.report.native.getWorkflowRunById(recoverableId))?.status).toBe('canceled');
    expect(
      (
        await queueObserver.execute(
          'SELECT status, COUNT(*) AS count FROM billing_workflow_runs GROUP BY status ORDER BY status',
        )
      ).rows,
    ).toEqual([
      { status: 'canceled', count: 1n },
      { status: 'uncertain', count: 100n },
    ]);
    expect(
      (
        await queueObserver.execute(
          'SELECT active, COUNT(*) AS count FROM billing_reservations GROUP BY active ORDER BY active',
        )
      ).rows,
    ).toEqual([
      { active: 0n, count: 1n },
      { active: 1n, count: 100n },
    ]);
    expect(queueModel.requests).toHaveLength(101);
  }, 120000);
});

it('migration indexes due retries without scanning accepted delivery history', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const runtime = await runtimeFixture({
    databaseUrl: database.url,
    directory: database.directory,
    modelUrl: model.url,
  });
  cleanups.push(runtime.close);
  const source = await runtime.billing.http.generate(
    'assistant',
    '[success] queue source',
    runtime.billingContext,
    'queue-source',
  );
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  const original = (await observer.execute('SELECT id, payload FROM billing_outbox')).rows[0];
  const payload = JSON.parse(String(original.payload));
  const future = Date.now() + 3600000;
  const statements: { sql: string; args: (string | number | bigint | null)[] }[] = [];
  for (let index = 0; index < 1005; index++) {
    const id = `queue-${index}`;
    const event = { ...payload, id: `usage:${id}`, executionId: id };
    const status =
      index < 1000
        ? 'accepted'
        : index === 1001 || index === 1004
          ? 'retrying'
          : index === 1002
            ? 'uncertain'
            : 'pending';
    statements.push(
      {
        sql: 'INSERT INTO billing_executions (id, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at) SELECT ?, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at FROM billing_executions WHERE id = ?',
        args: [id, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_ledger SELECT ?, account_id, meter, units, outcome, occurred_at FROM billing_ledger WHERE execution_id = ?',
        args: [id, source.billing.executionId],
      },
      {
        sql: 'INSERT INTO billing_outbox (id, execution_id, payload) VALUES (?, ?, ?)',
        args: [event.id, id, JSON.stringify(event)],
      },
      {
        sql: 'INSERT INTO billing_delivery (event_id, status, next_attempt, lease_until, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [event.id, status, index === 1003 ? future : 0, index === 1004 ? future : null, index + 1],
      },
    );
  }
  await observer.batch(statements, 'write');
  await removeDeliveryQueueMigration(observer);
  const history = async () =>
    Promise.all(
      ['billing_ledger', 'billing_outbox', 'billing_delivery'].map(
        async table => (await observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows,
      ),
    );
  const before = await history();
  const migrations = (await observer.execute('SELECT version, checksum FROM billing_migrations ORDER BY version')).rows;
  const args = [Date.now(), Date.now(), 100];
  const oldPlan = (await observer.execute({ sql: 'EXPLAIN QUERY PLAN ' + deliveryQueueQuery, args })).rows;
  expect(oldPlan.some(row => /SCAN d\b/.test(String(row.detail)))).toBe(true);
  const recovery = await RecoveryStorage.open({ url: database.url });
  cleanups.push(() => recovery.close());
  expect(await history()).toEqual(before);
  expect(
    (await observer.execute('SELECT version, checksum FROM billing_migrations WHERE version < 6 ORDER BY version'))
      .rows,
  ).toEqual(migrations);
  const indexedPlan = (await observer.execute({ sql: 'EXPLAIN QUERY PLAN ' + deliveryQueueQuery, args })).rows;
  expect(
    indexedPlan.some(
      row => /SEARCH d\b/.test(String(row.detail)) && String(row.detail).includes('billing_delivery_retryable'),
    ),
  ).toBe(true);
  const claimed = await recovery.claimDeliveries({ batchSize: 100, leaseMs: 60000 });
  expect(claimed.map(row => row.id)).toEqual([
    'usage:queue-1000',
    'usage:queue-1001',
    'usage:queue-1002',
    String(original.id),
  ]);
  expect(await recovery.claimDeliveries({ batchSize: 100, leaseMs: 60000 })).toEqual([]);
}, 30000);

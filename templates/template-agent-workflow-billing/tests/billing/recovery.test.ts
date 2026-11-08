import { afterEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { BillingRecovery } from '../../src/billing/recovery.js';
import { initializeBilling } from '../../src/billing/setup.js';
import { createBillingApp } from '../../src/server/billing.js';
import { polarFixture } from '../support/polar.js';
import { modelBoundary, runtimeFixture } from '../support/mastra.js';
import { independentClient, temporaryDatabase } from '../support/billing.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const secret = 'whsec_' + Buffer.from('a-test-only-32-byte-signing-secret').toString('base64');
function signed(
  customer: string | null,
  options: {
    id?: string;
    type?: string;
    secret?: string;
    legacy?: boolean;
    timestamp?: number;
    apiVersion?: string;
    occurredAt?: string;
  } = {},
) {
  const id = options.id ?? randomUUID();
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const value = options.secret ?? secret;
  // Deliberate whitespace and Unicode make JSON reserialization detectable.
  const body = Buffer.from(
    JSON.stringify(
      {
        api_version: options.apiVersion ?? '2026-10',
        type: options.type ?? 'customer.state_changed',
        timestamp: options.occurredAt ?? new Date().toISOString(),
        data: { id: customer, note: 'São Paulo' },
      },
      null,
      2,
    ) + '\n',
  );
  const key = options.legacy ? Buffer.from(value) : Buffer.from(value.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(body).digest('base64');
  return {
    body,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': `v1,${signature}`,
      'webhook-api-version': '2026-10',
    },
  };
}
async function fixture(options: Parameters<typeof polarFixture>[0] = {}) {
  const fixture = await polarFixture({ ...options, webhookSecret: secret });
  cleanups.push(fixture.close);
  const records = await RecoveryStorage.open({ url: fixture.database.url });
  cleanups.push(() => records.close());
  const worker = new BillingRecovery(records, fixture.commercial.provider);
  cleanups.push(() => worker.stop());
  return { ...fixture, records, worker };
}
async function socket(app: ReturnType<typeof createBillingApp>) {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await app.fetch(
      new Request(`http://127.0.0.1${request.url}`, {
        method: request.method,
        headers: request.headers as Record<string, string>,
        ...(['GET', 'HEAD'].includes(request.method!) ? {} : { body: Buffer.concat(chunks) }),
      }),
    );
    const headers: Record<string, string> = {};
    result.headers.forEach((value, key) => {
      headers[key] = value;
    });
    response.writeHead(result.status, headers);
    response.end(Buffer.from(await result.arrayBuffer()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP address');
  cleanups.push(async () => {
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    server.closeAllConnections();
    await closed;
  });
  return `http://127.0.0.1:${address.port}`;
}
const revoke = (f: Awaited<ReturnType<typeof fixture>>) => {
  for (const grant of f.wire.data.grants) {
    grant.is_granted = false;
    grant.is_revoked = true;
    grant.revoked_at = null;
  }
  f.wire.data.subscriptions[0].status = 'canceled';
};
function barrier() {
  let reached!: () => void, release!: () => void;
  const arrived = new Promise<void>(resolve => {
    reached = resolve;
  });
  const resume = new Promise<void>(resolve => {
    release = resolve;
  });
  return { reached, arrived, release, resume };
}

describe('durable billing recovery', () => {
  it('outbox survives restart and uncertain delivery without duplicate charges', async () => {
    const f = await fixture();
    const completed = await f.execute('completed');
    const debit = (await f.observer.execute('SELECT * FROM billing_ledger')).rows;
    const original = (await f.observer.execute('SELECT * FROM billing_outbox')).rows;
    f.wire.data.lostUsage = true;
    await f.worker.runOnce();
    expect(f.wire.data.events.size).toBe(1);
    expect((await f.gateway.read(f.owner.context, completed.billing.executionId)).billing.deliveryStatus).toBe(
      'uncertain',
    );
    const scheduled = (await f.observer.execute('SELECT attempts, next_attempt, last_error FROM billing_delivery'))
      .rows[0];
    expect(scheduled).toMatchObject({ attempts: 1n, last_error: 'provider_unavailable' });
    expect(Number(scheduled.next_attempt)).toBeGreaterThan(Date.now());
    const requestCount = f.wire.data.requests.length;
    await f.worker.runOnce();
    expect(f.wire.data.requests).toHaveLength(requestCount);
    await f.worker.stop();
    f.records.close();
    f.commercial.close();
    const changed = structuredClone(f.configuration);
    changed.polar!.meters[0].eventName = 'changed.after.restart';
    changed.polar!.meters[0].unitsField = 'changed_units';
    const reopened = await initializeBilling({ ...f.initialization, configuration: changed });
    cleanups.push(reopened.close);
    const records = await RecoveryStorage.open({ url: f.database.url });
    cleanups.push(() => records.close());
    const other = await RecoveryStorage.open({ url: f.database.url });
    cleanups.push(() => other.close());
    await f.observer.execute('UPDATE billing_delivery SET next_attempt = 0');
    // Repeated independent SQL contenders and real expiry prove lease reclaim
    // and stale acknowledgements, including the original lost provider response.
    for (let round = 0; round < 20; round++) {
      const claims = await Promise.all(
        [records, other].map(store => store.claimDeliveries({ batchSize: 1, leaseMs: 100 })),
      );
      expect(claims.map(list => list.length).sort()).toEqual([0, 1]);
      const stale = claims.flat()[0];
      await setTimeout(110);
      const [winner] = await other.claimDeliveries({ batchSize: 1, leaseMs: 1000 });
      expect(winner.id).toBe(stale.id);
      expect(winner.token).not.toBe(stale.token);
      expect(await records.completeDelivery(stale, { status: 'accepted', eventId: stale.id })).toBe(false);
      if (round === 19) expect(await other.deliver(reopened.provider, winner)).toBe(true);
      else {
        await other.completeDelivery(winner, { status: 'uncertain', code: 'lost_acknowledgement' });
        await f.observer.execute('UPDATE billing_delivery SET next_attempt = 0');
      }
    }
    expect(f.wire.data.events.size).toBe(1);
    const wires = f.wire.data.requests
      .filter(request => request.path === '/v1/events/ingest')
      .map(request => request.body);
    expect(wires).toHaveLength(2);
    expect(wires[1]).toEqual(wires[0]);
    expect(wires[1].events[0]).toMatchObject({ name: 'work.succeeded', metadata: { units: 3 } });
    expect((await f.gateway.read(f.owner.context, completed.billing.executionId)).billing.deliveryStatus).toBe(
      'accepted',
    );
    expect((await f.observer.execute('SELECT * FROM billing_ledger')).rows).toEqual(debit);
    expect((await f.observer.execute('SELECT * FROM billing_outbox')).rows).toEqual(original);
    expect(
      (await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows[0].consumed,
    ).toBe(3n);
    expect((await f.execute('completed')).billing.billedUnits).toBe(3);
    expect(f.calls()).toBe(1);
    // A permanent provider rejection remains visible and cannot retry silently.
    const fresh = await fixture();
    const rejected = await fresh.execute('permanent');
    fresh.wire.data.rejectUsage = true;
    await fresh.worker.runOnce();
    expect((await fresh.gateway.read(fresh.owner.context, rejected.billing.executionId)).billing.deliveryStatus).toBe(
      'failed',
    );
    const before = fresh.wire.data.requests.length;
    await fresh.worker.runOnce();
    expect(fresh.wire.data.requests).toHaveLength(before);
    expect(await fresh.worker.metrics()).toMatchObject({ deliveries: [{ status: 'failed', count: 1 }] });
  }, 30000);

  it('verified webhook inbox rejects forgery and reconciles duplicate out of order events', async () => {
    const f = await fixture();
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.context.workspaceId });
    const url = await socket(createBillingApp(f.organizations, undefined, f.sessions, f.worker));
    const send = (input: ReturnType<typeof signed>, path = '/billing/webhooks/polar', method = 'POST') =>
      fetch(url + path, { method, headers: input.headers, ...(method === 'GET' ? {} : { body: input.body }) });
    for (const webhookSecret of ['', '\n', '   '])
      await expect(
        initializeBilling({ ...f.initialization, polar: { ...f.initialization.polar, webhookSecret } }),
      ).rejects.toMatchObject({ code: 'invalid_configuration' });
    const first = signed(f.wire.ids.customer);
    expect((await send({ ...first, body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), first.body]) })).status).toBe(
      401,
    );
    expect((await send(first)).status).toBe(202);
    expect((await f.observer.execute('SELECT status FROM billing_inbox')).rows).toEqual([{ status: 'pending' }]);
    expect((await f.observer.execute('SELECT id FROM credit_grants')).rows).toEqual([]);
    expect((await send(first)).status).toBe(202);
    expect((await f.observer.execute('SELECT generation FROM billing_account_sync')).rows[0].generation).toBe(1n);
    expect(
      (await send(signed(f.wire.ids.customer, { id: first.headers['webhook-id'], occurredAt: '2020-01-01T00:00:00Z' })))
        .status,
    ).toBe(409);
    const tampered = { ...signed(f.wire.ids.customer), body: Buffer.from(first.body.toString().replace('São', 'Sao')) };
    expect((await send(tampered)).status).toBe(401);
    for (const timestamp of [0, Math.floor(Date.now() / 1000) + 1000])
      expect((await send(signed(f.wire.ids.customer, { timestamp }))).status).toBe(401);
    const missing = signed(f.wire.ids.customer);
    delete (missing.headers as Partial<typeof missing.headers>)['webhook-signature'];
    expect((await send(missing)).status).toBe(401);
    expect((await send(signed(f.wire.ids.customer, { secret: 'different', legacy: true }))).status).toBe(401);
    expect((await send(signed(f.wire.ids.customer, { legacy: true }))).status).toBe(202);
    expect((await send(signed(f.wire.ids.customer, { apiVersion: '2025-01' }))).status).toBe(400);
    const wrongHeader = signed(f.wire.ids.customer);
    wrongHeader.headers['webhook-api-version'] = '2025-01';
    expect((await send(wrongHeader)).status).toBe(400);
    expect((await send(signed(null, { type: 'future.unrecognized' }))).status).toBe(202);
    expect((await send(signed(null, { type: 'future.unrecognized', secret: 'bad', legacy: true }))).status).toBe(401);
    for (const path of ['/billing/context', '/billing/webhooks/polar/', '/billing/webhooks/polar/extra'])
      expect((await send(first, path)).status).toBe(401);
    expect((await send(first, '/billing/webhooks/polar', 'GET')).status).toBe(401);
    expect(
      (
        await fetch(url + '/billing/webhooks/polar', {
          method: 'POST',
          headers: first.headers,
          body: Buffer.alloc(17000),
        })
      ).status,
    ).toBe(413);
    await f.worker.runOnce();
    expect(
      (await f.observer.execute('SELECT status, COUNT(*) AS count FROM billing_inbox GROUP BY status ORDER BY status'))
        .rows,
    ).toEqual([
      { status: 'done', count: 2n },
      { status: 'ignored', count: 1n },
    ]);
    expect((await f.commercial.provider.getState(account)).meters[0].confirmedBalance).toBe(10);
    revoke(f);
    const newer = signed(f.wire.ids.customer),
      older = signed(f.wire.ids.customer, { occurredAt: '2020-01-01T00:00:00Z' });
    expect((await send(newer)).status).toBe(202);
    await f.worker.runOnce();
    expect((await send(older)).status).toBe(202);
    await f.worker.runOnce();
    expect(
      (
        await f.observer.execute(
          'SELECT original_units, consumed_units, available FROM credit_grants ORDER BY original_units',
        )
      ).rows,
    ).toEqual([
      { original_units: 4n, consumed_units: 0n, available: 0n },
      { original_units: 6n, consumed_units: 0n, available: 0n },
    ]);
    expect(f.calls()).toBe(0);
    await f.worker.intake(signed(f.wire.ids.customer));
    const paused = barrier();
    f.wire.data.pause = {
      path: `/v1/products/${f.wire.ids.orderProduct}`,
      reached: paused.reached,
      release: paused.resume,
    };
    const active = f.worker.runOnce();
    await paused.arrived;
    let drained = false;
    const stopping = f.worker.stop().then(() => {
      drained = true;
    });
    await setTimeout(20);
    expect(drained).toBe(false);
    paused.release();
    await Promise.all([active, stopping]);
    expect(drained).toBe(true);
    f.records.close();
    expect((await send(signed(f.wire.ids.customer))).status).toBe(503);
  }, 30000);

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
      const child = fork(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [kind, JSON.stringify(options)],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      cleanups.push(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
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

    const orphan = fork(
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

    const suspendedChild = fork(
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
        const child = fork(
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
      'expiry-legacy',
      'expiry-unconfirmed-canceled',
      'expiry-missing',
      'expiry-active',
    ]) {
      const boundaryDatabase = await temporaryDatabase();
      cleanups.push(boundaryDatabase.cleanup);
      const boundaryModel = await modelBoundary();
      cleanups.push(boundaryModel.close);
      const child = fork(
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
      cleanups.push(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
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

  it('grant synchronization recovers without duplicate funding or stale credit resurrection', async () => {
    const f = await fixture();
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.context.workspaceId });
    await f.commercial.provider.getState(account);
    await f.execute('settled-before-recovery');
    const consumed = (
      await f.observer.execute(
        'SELECT source_key, original_units, consumed_units, fingerprint, provenance FROM credit_grants ORDER BY source_key',
      )
    ).rows;
    const crash = async (phase: 'source-intake' | 'source-apply', notification = signed(f.wire.ids.customer)) => {
      const child = fork(
        fileURLToPath(new URL('../support/recovery-worker.mjs', import.meta.url)),
        [
          phase,
          JSON.stringify({
            ...f.initialization,
            polar: { token: 'loopback-test-token', webhookSecret: secret },
            account,
            notification: { body: notification.body.toString('base64'), headers: notification.headers },
          }),
        ],
        { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      cleanups.push(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      let diagnostics = '';
      child.stderr?.on('data', chunk => {
        diagnostics = (diagnostics + chunk).slice(-4000);
      });
      await Promise.race([
        once(child, 'message'),
        once(child, 'exit').then(() => {
          throw new Error(diagnostics);
        }),
      ]);
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
    };
    await crash('source-intake');
    expect(
      (await f.observer.execute("SELECT COUNT(*) AS count FROM billing_inbox WHERE status = 'pending'")).rows[0].count,
    ).toBe(1n);
    // Applying the same authoritative sources commits both bucket state and
    // covered inbox hints before another abrupt process death.
    await crash('source-apply');
    expect((await f.observer.execute('SELECT status FROM billing_inbox')).rows).toEqual([{ status: 'done' }]);
    const other = await RecoveryStorage.open({ url: f.database.url });
    cleanups.push(() => other.close());
    for (let round = 0; round < 20; round++) {
      await f.worker.intake(signed(f.wire.ids.customer));
      const [stale] = await f.records.claimSynchronizations({ batchSize: 1, leaseMs: 100 });
      const paused = barrier();
      f.wire.data.pause = {
        path: `/v1/products/${f.wire.ids.orderProduct}`,
        reached: paused.reached,
        release: paused.resume,
      };
      const old = f.commercial.provider.getState(account, { token: stale.token });
      const oldResult = old.then(
        value => ({ value }),
        error => ({ error }),
      );
      await paused.arrived;
      await f.worker.intake(signed(f.wire.ids.customer)); // Revokes the in-flight observation.
      await setTimeout(110);
      const [winner] = await other.claimSynchronizations({ batchSize: 1, leaseMs: 5000 });
      expect(winner.token).not.toBe(stale.token);
      // Synchronous paid-admission refresh and leased recovery use one source
      // application service; either can complete hints without minting again.
      const latest = await f.commercial.provider.getState(account);
      expect(latest.meters[0].confirmedBalance).toBe(7);
      paused.release();
      expect(await oldResult).toHaveProperty('error');
      expect(await f.records.completeSynchronization(stale, true)).toBe(false);
      await f.commercial.provider.getState(account, { token: winner.token });
      expect(await other.completeSynchronization(winner, true)).toBe(true);
      expect(
        (
          await f.observer.execute(
            'SELECT source_key, original_units, consumed_units, fingerprint, provenance FROM credit_grants ORDER BY source_key',
          )
        ).rows,
      ).toEqual(consumed);
    }
    // A notification while a formerly eligible read waits must prevent stale
    // restoration, even when it came from an older event occurrence timestamp.
    const paused = barrier();
    f.wire.data.pause = {
      path: `/v1/products/${f.wire.ids.orderProduct}`,
      reached: paused.reached,
      release: paused.resume,
    };
    const admission = f.execute('invalidated-admission');
    const denied = admission.then(
      value => ({ value }),
      error => ({ error }),
    );
    await paused.arrived;
    revoke(f);
    await f.worker.intake(signed(f.wire.ids.customer, { occurredAt: '2020-01-01T00:00:00Z' }));
    paused.release();
    expect(await denied).toMatchObject({ error: { code: 'forbidden' } });
    await f.worker.runOnce();
    expect(f.calls()).toBe(1);
    expect(
      (
        await f.observer.execute(
          'SELECT source_key, original_units, consumed_units, fingerprint, provenance FROM credit_grants ORDER BY source_key',
        )
      ).rows,
    ).toEqual(consumed);
    expect((await f.observer.execute('SELECT available FROM credit_grants')).rows).toEqual([
      { available: 0n },
      { available: 0n },
    ]);
    // Missing evidence is not cached eligibility and cannot clear pending hints.
    f.wire.data.unavailable = true;
    await f.worker.intake(signed(f.wire.ids.customer));
    await f.worker.runOnce();
    await expect(f.execute('outage')).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(
      (await f.observer.execute("SELECT COUNT(*) AS count FROM billing_inbox WHERE status = 'pending'")).rows[0].count,
    ).toBe(1n);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows[0].units).toBe(3n);
    expect(
      (await f.observer.execute('SELECT generation, synchronized_generation, last_error FROM billing_account_sync'))
        .rows[0],
    ).toMatchObject({ last_error: 'source_unavailable' });
    const metrics = JSON.stringify(await f.worker.metrics());
    expect(metrics).not.toContain(secret);
    expect(metrics).not.toContain(f.wire.ids.customer);
    expect(metrics).not.toContain('São Paulo');
    const held = barrier();
    const holding = await fixture({
      executor: async () => {
        held.reached();
        await held.resume;
        return { status: 'failed' };
      },
    });
    const failing = holding.execute('held-across-source-expiry');
    await held.arrived;
    holding.wire.data.subscriptions[0].current_period_end = new Date(Date.now() - 1000).toISOString();
    const orderGrant = holding.wire.data.grants.find(grant => grant.order_id !== null)!;
    orderGrant.is_granted = false;
    orderGrant.is_revoked = true;
    await holding.worker.intake(signed(holding.wire.ids.customer));
    await holding.worker.runOnce();
    expect((await holding.observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 1n }]);
    held.release();
    expect((await failing).billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
    const accountAfterExpiry = await holding.commercial.provider.ensureAccount({
      workspaceId: holding.owner.context.workspaceId,
    });
    await holding.commercial.provider.getState(accountAfterExpiry);
    expect(
      (
        await holding.observer.execute(
          'SELECT original_units, consumed_units, available FROM credit_grants ORDER BY original_units',
        )
      ).rows,
    ).toEqual([
      { original_units: 4n, consumed_units: 0n, available: 0n },
      { original_units: 6n, consumed_units: 0n, available: 0n },
    ]);
    expect((await holding.observer.execute('SELECT active FROM billing_reservations')).rows).toEqual([{ active: 0n }]);
  }, 60000);
});

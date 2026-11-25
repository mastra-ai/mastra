import {
  Knowledge,
  KnowledgeImporterHostConflictError,
  createKnowledgeImporterHost,
  knowledgeImporterFlushDigest,
} from '@mastra/core/knowledge';
import type {
  KnowledgeImporterOp,
  KnowledgeImporterRunBinding,
  KnowledgeImporterServiceHost,
} from '@mastra/core/knowledge';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { KnowledgeImporterHostFixture } from './importer-host';

/** Lease short enough to lapse in a test, long enough that a live runner renews it comfortably. */
const LEASE_MS = 600;
const lapse = () => new Promise(resolve => setTimeout(resolve, LEASE_MS + 250));

/**
 * A service host (`createKnowledgeImporterHost` with `leaseMs`, r352 S1–S5): Platform's
 * knowledge-service applies flushes for runs whose runners live in customer apps, so a run is only
 * live while its lease holds, by the database's clock, and a claim is admitted in the same
 * transaction that starts the run and materializes its scope.
 */
export function createKnowledgeHostedImporterHostTests(
  createFixture: () => Promise<KnowledgeImporterHostFixture>,
): void {
  let fixture: KnowledgeImporterHostFixture;
  beforeEach(async () => {
    fixture = await createFixture();
  });
  afterEach(async () => {
    await fixture.cleanup();
  });

  const binding: KnowledgeImporterRunBinding = {
    id: 'b1',
    importer: 'notes',
    target: 'docs:acme#notion',
    settings: {},
    credentials: {},
  };

  function setup(storage: MastraCompositeStore = fixture.storage) {
    const knowledge = new Knowledge({ scopes: { 'docs:$orgId': {} }, storage });
    const host = createKnowledgeImporterHost(knowledge, { bindings: [binding], leaseMs: LEASE_MS });
    const scopeExists = async () => {
      const store = await knowledge.getStorage();
      return (await store.getScopesByAddress(['docs:acme'])).length > 0;
    };
    const guard = async () => (await knowledge.getStorage()).importers!.readWriterGuard();
    const runRow = async (runId: string) => (await knowledge.getStorage()).importers!.getRun(runId);
    return { knowledge, host, scopeExists, guard, runRow };
  }

  async function start(host: KnowledgeImporterServiceHost, options = {}) {
    const started = await host.startRun('b1', options);
    if (started.status !== 'started') throw new Error(`not started: ${started.status}`);
    return started;
  }

  const ops = (body: string): KnowledgeImporterOp[] => [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body } }];

  async function flush(
    host: KnowledgeImporterServiceHost,
    run: { runId: string; generation: number },
    seq: number,
    body: string,
  ) {
    const flushOps = ops(body);
    return host.flush({
      runId: run.runId,
      generation: run.generation,
      seq,
      digest: await knowledgeImporterFlushDigest({ ops: flushOps }),
      ops: flushOps,
    });
  }

  const finishOf = (run: { runId: string; generation: number }, lastSeq: number) => ({
    runId: run.runId,
    generation: run.generation,
    outcome: 'succeeded' as const,
    backlog: false,
    lastSeq,
  });

  const conflict = (code: string) => ({ name: KnowledgeImporterHostConflictError.name, code });

  describe('service importer host: lease (S1)', () => {
    it('admits heartbeats, flushes and finish while the lease is renewed', async () => {
      const { host } = setup();
      const run = await start(host);
      await flush(host, run, 1, 'one');
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, LEASE_MS / 3));
        expect(await host.heartbeat(run.runId, run.generation)).toEqual({ cancel: false });
      }
      await flush(host, run, 2, 'two');
      await expect(host.finishRun(finishOf(run, 2))).resolves.toMatchObject({ outcome: 'succeeded' });
    });

    it('refuses a heartbeat, a new flush and a finish once the lease lapsed, and the heartbeat does not revive it', async () => {
      const { host, runRow } = setup();
      const run = await start(host);
      const first = await flush(host, run, 1, 'one');
      const renewed = (await runRow(run.runId))!.heartbeatAt;
      await lapse();

      await expect(host.heartbeat(run.runId, run.generation)).rejects.toMatchObject(conflict('run_not_active'));
      expect((await runRow(run.runId))!.heartbeatAt).toEqual(renewed);
      await expect(flush(host, run, 2, 'two')).rejects.toMatchObject(conflict('run_not_active'));
      await expect(host.finishRun(finishOf(run, 1))).rejects.toMatchObject(conflict('run_not_active'));
      // A committed receipt never depends on the run still being live.
      await expect(flush(host, run, 1, 'one')).resolves.toEqual(first);
    });

    it('refuses a finish past the run deadline even while the lease holds', async () => {
      const { host } = setup();
      const run = await start(host, { deadline: Date.now() + 300 });
      await new Promise(resolve => setTimeout(resolve, 400));
      await expect(host.finishRun(finishOf(run, 0))).rejects.toMatchObject(conflict('run_not_active'));
    });

    it('answers a heartbeat on a canceled run with cancel and does not renew it', async () => {
      const { host, runRow } = setup();
      const run = await start(host);
      const before = (await runRow(run.runId))!.heartbeatAt;
      await host.requestCancel(run.runId);
      expect(await host.heartbeat(run.runId, run.generation)).toEqual({ cancel: true });
      expect((await runRow(run.runId))!.heartbeatAt).toEqual(before);
      await expect(flush(host, run, 1, 'one')).rejects.toMatchObject(conflict('run_not_active'));
    });
  });

  describe('service importer host: expiry sweep and marked abandonment (S2, S3)', () => {
    it('ends runs past their lease or deadline, marked as ended by the host', async () => {
      const { host, runRow } = setup();
      const lapsed = await start(host);
      await lapse();
      expect((await host.expireRuns()).expired).toEqual([lapsed.runId]);
      expect(await runRow(lapsed.runId)).toMatchObject({
        status: 'failed',
        finish: expect.objectContaining({ by: 'host', error: expect.objectContaining({ code: 'lease_expired' }) }),
      });

      const late = await start(host, { deadline: Date.now() + 200 });
      await new Promise(resolve => setTimeout(resolve, 300));
      expect((await host.expireRuns()).expired).toEqual([late.runId]);
      expect((await runRow(late.runId))!.finish).toMatchObject({
        by: 'host',
        error: expect.objectContaining({ code: 'deadline_exceeded' }),
      });
      expect((await host.expireRuns()).expired).toEqual([]);
    });

    it('ends a canceled run that lapsed as canceled, without chaining', async () => {
      const { host, runRow } = setup();
      const run = await start(host);
      await host.requestCancel(run.runId);
      await lapse();
      expect((await host.expireRuns()).expired).toEqual([run.runId]);
      expect(await runRow(run.runId)).toMatchObject({
        status: 'canceled',
        finish: expect.objectContaining({ by: 'host', chain: false }),
      });
    });

    it('leaves a live run alone', async () => {
      const { host, runRow } = setup();
      const run = await start(host);
      expect((await host.expireRuns()).expired).toEqual([]);
      expect((await runRow(run.runId))!.status).toBe('running');
    });

    it("refuses the app's finish after the host ended the run, but still replays its committed flushes", async () => {
      const { host } = setup();
      const run = await start(host);
      const first = await flush(host, run, 1, 'one');
      await lapse();
      await host.expireRuns();
      await expect(host.finishRun(finishOf(run, 1))).rejects.toMatchObject(conflict('run_not_active'));
      await expect(flush(host, run, 1, 'one')).resolves.toEqual(first);
      await expect(flush(host, run, 1, 'changed')).rejects.toMatchObject(conflict('digest_mismatch'));
      await expect(flush(host, run, 2, 'two')).rejects.toMatchObject(conflict('run_not_active'));
    });
  });

  describe('service importer host: reading a run back', () => {
    it('reads no receipt while a run is going, then the receipt its finish stored', async () => {
      const { host } = setup();
      expect(await host.readRun('no-such-run')).toBeNull();
      const run = await start(host);
      expect(await host.readRun(run.runId)).toEqual({ status: 'running', receipt: null });
      await flush(host, run, 1, 'one');
      const receipt = await host.finishRun({ ...finishOf(run, 1), backlog: true });
      expect(receipt.chain).toBe(true);
      expect(await host.readRun(run.runId)).toEqual({ status: 'succeeded', receipt });
    });

    it('reads the receipt the host recorded for a run it ended, canceled ones included', async () => {
      const { host } = setup();
      const lapsed = await start(host);
      await lapse();
      await host.expireRuns();
      expect(await host.readRun(lapsed.runId)).toMatchObject({
        status: 'failed',
        receipt: { outcome: 'failed', chain: false, error: expect.objectContaining({ code: 'lease_expired' }) },
      });

      const canceled = await start(host);
      await host.requestCancel(canceled.runId);
      await host.finishRun({ ...finishOf(canceled, 0), backlog: true });
      expect(await host.readRun(canceled.runId)).toMatchObject({
        status: 'canceled',
        receipt: { outcome: 'canceled', backlog: false, chain: false },
      });
    });

    it('reads no receipt for a run that ended without a stored finish', async () => {
      // The local host always stores one; a host that ends runs itself may not.
      const { host, knowledge } = setup();
      const run = await start(host);
      const storage = await knowledge.getStorage();
      await storage.transaction(tx => tx.importers!.abandonRun({ runId: run.runId, finish: null, status: 'failed' }));
      expect(await host.readRun(run.runId)).toEqual({ status: 'failed', receipt: null });
    });
  });

  describe('service importer host: admission at start (S4)', () => {
    it('admits a claim, materializes the scope and creates the run in one transaction', async () => {
      const { host, scopeExists, guard } = setup();
      const g = await guard();
      let admittedInside = false;
      const run = await start(host, {
        generation: g.generation,
        admit: async () => {
          admittedInside = true;
        },
      });
      expect(admittedInside).toBe(true);
      expect(await scopeExists()).toBe(true);
      expect((await guard()).firstWriteAt).not.toBeNull();
      await expect(flush(host, run, 1, 'one')).resolves.toMatchObject({ created: 1 });
    });

    it('rolls back the scope, the run and the claim when admission throws', async () => {
      const { host, scopeExists, guard, knowledge } = setup();
      const g = await guard();
      await expect(
        host.startRun('b1', {
          generation: g.generation,
          admit: async tx => {
            // Stands in for the caller's dispatch row: written through the start transaction.
            await tx.importers!.setState('b1', { claim: 'claimed' });
            throw new Error('dispatch already claimed');
          },
        }),
      ).rejects.toThrow('dispatch already claimed');
      expect(await scopeExists()).toBe(false);
      expect((await guard()).firstWriteAt).toBeNull();
      const importers = (await knowledge.getStorage()).importers!;
      expect((await importers.getState('b1')).claim).toBeUndefined();
      expect(await importers.listRuns('b1')).toEqual([]);
    });

    it('rolls back the claim when another run of the binding is going, and reports skipped', async () => {
      const { host, guard, knowledge } = setup();
      const first = await start(host);
      const g = await guard();
      const skipped = await host.startRun('b1', {
        generation: g.generation,
        admit: async tx => {
          await tx.importers!.setState('b1', { claim: 'claimed' });
        },
      });
      expect(skipped.status).toBe('skipped');
      const importers = (await knowledge.getStorage()).importers!;
      expect((await importers.getState('b1')).claim).toBeUndefined();
      expect((await importers.listRuns('b1')).map(r => r.id)).toEqual([first.runId]);
    });

    it('refuses a claim for an older writer generation before admitting it (rollback first)', async () => {
      const { host, scopeExists, guard, knowledge } = setup();
      const g = await guard();
      await (
        await knowledge.getStorage()
      ).importers!.advanceWriterGuard({
        activePath: 'new',
        generation: g.generation + 1,
      });
      let admitted = false;
      await expect(
        host.startRun('b1', {
          generation: g.generation,
          admit: async () => {
            admitted = true;
          },
        }),
      ).rejects.toMatchObject(conflict('stale_generation'));
      expect(admitted).toBe(false);
      expect(await scopeExists()).toBe(false);
      expect((await guard()).firstWriteAt).toBeNull();
    });

    it('refuses a claim while another write path is active', async () => {
      const { host, guard, knowledge } = setup();
      const g = await guard();
      await (
        await knowledge.getStorage()
      ).importers!.advanceWriterGuard({
        activePath: 'legacy',
        generation: g.generation + 1,
      });
      await expect(host.startRun('b1', { generation: g.generation + 1, admit: async () => {} })).rejects.toMatchObject(
        conflict('stale_generation'),
      );
    });

    it('a committed claim leaves first_write_at set, so a later rollback sees the instance was written (claim first)', async () => {
      const { host, guard } = setup();
      const g = await guard();
      await start(host, { generation: g.generation, admit: async () => {} });
      expect((await guard()).firstWriteAt).not.toBeNull();
    });
  });

  describe('service importer host: cancel serialized with finish (S5)', () => {
    it('stores a finish admitted after a committed cancel as canceled, and replays it exactly', async () => {
      const { host } = setup();
      const run = await start(host);
      await flush(host, run, 1, 'one');
      await host.requestCancel(run.runId);
      const receipt = await host.finishRun({ ...finishOf(run, 1), backlog: true });
      expect(receipt).toMatchObject({
        outcome: 'canceled',
        chain: false,
        counts: expect.objectContaining({ created: 1 }),
      });
      await expect(host.finishRun({ ...finishOf(run, 1), backlog: true })).resolves.toEqual(receipt);
      await expect(host.finishRun(finishOf(run, 1))).rejects.toMatchObject(conflict('finish_mismatch'));
    });

    it('keeps the outcome of a finish that committed before the cancel', async () => {
      const { host, runRow } = setup();
      const run = await start(host);
      const receipt = await host.finishRun(finishOf(run, 0));
      await host.requestCancel(run.runId);
      expect(await runRow(run.runId)).toMatchObject({ status: 'succeeded', cancelRequestedAt: null });
      await expect(host.finishRun(finishOf(run, 0))).resolves.toEqual(receipt);
    });
  });
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../../storage';
import { Knowledge, createKnowledgeImporterHost } from '../../index';
import { knowledgeImporterFlushDigest } from '../host';
import type { KnowledgeImporterRunBinding } from '../host';
import type { KnowledgeImporterOp } from '../types';

/**
 * A host that runs no importer code (Platform's knowledge-service) applies flushes for bindings it
 * reads from its own config: `createKnowledgeImporterHost(knowledge, { bindings })`.
 */

const binding = (id: string, target: string): KnowledgeImporterRunBinding => ({
  id,
  importer: 'notion',
  target,
  settings: {},
  credentials: {},
});

function setup() {
  const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: { 'docs:$orgId': {} } });
  return { knowledge };
}

async function pageAt(knowledge: Knowledge, path: string) {
  const storage = await knowledge.getStorage();
  const [scope] = await storage.getScopesByAddress(['docs:acme']);
  return scope ? storage.getPageByPath({ scopeId: scope.id, path: path.split('/'), read: 'all' }) : null;
}

async function flushOne(
  host: ReturnType<typeof createKnowledgeImporterHost>,
  bindingId: string,
  ops: KnowledgeImporterOp[],
) {
  const started = await host.startRun(bindingId);
  if (started.status !== 'started') throw new Error(`not started: ${started.status}`);
  const receipt = await host.flush({
    runId: started.runId,
    generation: started.generation,
    seq: 1,
    digest: await knowledgeImporterFlushDigest({ ops }),
    ops,
  });
  return { started, receipt };
}

describe('createKnowledgeImporterHost', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies flushes for a Knowledge with no importers of its own, returning the binding it ran', async () => {
    const { knowledge } = setup();
    expect(knowledge.importers).toBeUndefined();
    const host = createKnowledgeImporterHost(knowledge, { bindings: [binding('b1', 'docs:acme#notion')] });

    const { started, receipt } = await flushOne(host, 'b1', [
      { op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'hello' } },
    ]);
    expect(started).toMatchObject({ binding: binding('b1', 'docs:acme#notion') });
    expect(receipt).toMatchObject({ seq: 1, created: 1 });
    expect((await pageAt(knowledge, 'notion/p1'))?.body).toContain('hello');
  });

  it('reads bindings from a function at each start, so config changes apply without a new host', async () => {
    const { knowledge } = setup();
    let current = [binding('b1', 'docs:acme#notion')];
    const reads = vi.fn(async () => current);
    const host = createKnowledgeImporterHost(knowledge, { bindings: reads });

    await expect(host.startRun('b2')).rejects.toMatchObject({ status: 404 });
    current = [binding('b1', 'docs:acme#notion'), binding('b2', 'docs:acme#linear')];
    expect((await host.startRun('b2')).status).toBe('started');
    current = [binding('b2', 'docs:acme#linear')];
    await expect(host.startRun('b1')).rejects.toMatchObject({ status: 404 });
    expect(reads).toHaveBeenCalledTimes(3);
  });

  it('refuses a start whose target overlaps another binding the function returns', async () => {
    const { knowledge } = setup();
    const host = createKnowledgeImporterHost(knowledge, {
      bindings: async () => [binding('b1', 'docs:acme#notion'), binding('b2', 'docs:acme#notion/eng')],
    });
    await expect(host.startRun('b2')).rejects.toMatchObject({ status: 409 });
  });

  it('records the configured author on imported pages', async () => {
    const { knowledge } = setup();
    const host = createKnowledgeImporterHost(knowledge, {
      bindings: [binding('b1', 'docs:acme#notion')],
      author: b => `platform:importer:${b.id}`,
    });
    await flushOne(host, 'b1', [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'x' } }]);
    expect((await pageAt(knowledge, 'notion/p1'))?.createdBy).toMatchObject({ author: 'platform:importer:b1' });
  });

  it('reclaims a silent run after staleRunAfterMs rather than the 5-minute default', async () => {
    const { knowledge } = setup();
    const host = createKnowledgeImporterHost(knowledge, {
      bindings: [binding('b1', 'docs:acme#notion')],
      staleRunAfterMs: 90_000,
    });
    const first = await host.startRun('b1');
    if (first.status !== 'started') throw new Error('not started');

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
    expect((await host.startRun('b1')).status).toBe('skipped');
    vi.setSystemTime(Date.now() + 40_000);
    expect((await host.startRun('b1')).status).toBe('started');
    expect(await host.heartbeat(first.runId, first.generation)).toEqual({ cancel: true });
  });

  describe('a flush whose bindings read fails while an identical flush commits', () => {
    const ops: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'first' } }];

    /** Bindings whose `park`-th read waits until the test rejects it; every other read resolves. */
    function parkedBindings(park: number) {
      let reads = 0;
      let reject!: (error: Error) => void;
      let reached!: () => void;
      const parkedAt = new Promise<void>(resolve => (reached = resolve));
      const bindings = async () => {
        reads += 1;
        if (reads !== park) return [binding('b1', 'docs:acme#notion')];
        reached();
        return new Promise<never>((_, fail) => (reject = fail));
      };
      return { bindings, parkedAt, rejectRead: (error: Error) => reject(error) };
    }

    async function race(retryOps: KnowledgeImporterOp[]) {
      const { knowledge } = setup();
      // Read 1 is startRun; read 2 is the retry's flush, after its receipt lookup missed.
      const gate = parkedBindings(2);
      const host = createKnowledgeImporterHost(knowledge, { bindings: gate.bindings });
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const flushOf = async (flushOps: KnowledgeImporterOp[]) =>
        host.flush({
          runId: started.runId,
          generation: started.generation,
          seq: 1,
          digest: await knowledgeImporterFlushDigest({ ops: flushOps }),
          ops: flushOps,
        });

      const retry = flushOf(retryOps);
      await gate.parkedAt;
      const committed = await flushOf(ops);
      gate.rejectRead(new Error('bindings store is down'));
      return { committed, retry };
    }

    it('returns the committed receipt to an exact replay', async () => {
      const { committed, retry } = await race(ops);
      expect(committed).toMatchObject({ seq: 1, created: 1 });
      await expect(retry).resolves.toEqual(committed);
    });

    it('refuses changed content for the committed seq as digest_mismatch', async () => {
      const changed: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'changed' } }];
      const { retry } = await race(changed);
      await expect(retry).rejects.toMatchObject({ code: 'digest_mismatch' });
    });

    it('surfaces the bindings failure when the flush is new work', async () => {
      const { knowledge } = setup();
      let reads = 0;
      const host = createKnowledgeImporterHost(knowledge, {
        bindings: async () => {
          reads += 1;
          if (reads > 1) throw new Error('bindings store is down');
          return [binding('b1', 'docs:acme#notion')];
        },
      });
      const started = await host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      await expect(
        host.flush({
          runId: started.runId,
          generation: started.generation,
          seq: 1,
          digest: await knowledgeImporterFlushDigest({ ops }),
          ops,
        }),
      ).rejects.toThrow();
      expect(await pageAt(knowledge, 'notion/p1')).toBeNull();
    });
  });
});

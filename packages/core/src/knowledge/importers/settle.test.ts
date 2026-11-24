import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../storage';
import { KnowledgeTransactionDeadlineError } from '../../storage/domains/knowledge/base';
import { Knowledge } from '../index';
import { KnowledgeImporter } from './define';
import type { KnowledgeImporterContext } from './define';
import { knowledgeImporterFlushDigest } from './host';
import { applyKnowledgeImportFlush } from './sink';
import type { KnowledgeImporterOp, KnowledgeImportItem } from './types';

/**
 * Settle work (r347 O3 §C, §C′, §C″): pages that arrived before their parent are moved under it,
 * and links written once their target exists, a bounded slice per flush; the run chains on what's
 * left only when settling made progress.
 */

const upsert = (item: Partial<KnowledgeImportItem> & { sourceId: string }): KnowledgeImporterOp => ({
  op: 'upsert',
  item: { title: item.sourceId.toUpperCase(), body: `body of ${item.sourceId}`, ...item },
});

function setup() {
  const store = new InMemoryStore();
  let passes: KnowledgeImporterOp[][] = [];
  const knowledge = new Knowledge({
    storage: store,
    scopes: { 'docs:$orgId': {} },
    importers: [
      new (class extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
        async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
          for (const op of passes.shift() ?? []) {
            if (op.op === 'upsert') await ctx.items.upsert(op.item);
            else if (op.op === 'remove') await ctx.items.remove(op.sourceId);
          }
          if (passes.length) ctx.reportBacklog();
        }
      })({ id: 'b1', target: 'docs:acme#notion' }),
    ],
  });
  const host = knowledge.importers!.host;
  const page = async (path: string) => {
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    return scope ? storage.getPageByPath({ scopeId: scope.id, path: path.split('/'), read: 'all' }) : null;
  };
  const start = async () => {
    const started = await host.startRun('b1');
    if (started.status !== 'started') throw new Error('not started');
    let seq = started.lastSeq;
    const flush = async (ops: KnowledgeImporterOp[]) => {
      seq++;
      return host.flush({
        runId: started.runId,
        generation: started.generation,
        seq,
        digest: await knowledgeImporterFlushDigest({ ops }),
        ops,
      });
    };
    const finish = (backlog = false) =>
      host.finishRun({
        runId: started.runId,
        generation: started.generation,
        outcome: 'succeeded',
        backlog,
        lastSeq: seq,
      });
    return { started, flush, finish };
  };
  const run = (next: KnowledgeImporterOp[][]) => {
    passes = next;
    return knowledge.importers!.run('b1');
  };
  return { knowledge, host, page, start, run };
}

const children = (n: number) =>
  Array.from({ length: n }, (_, i) => upsert({ sourceId: `c${String(i).padStart(3, '0')}`, parent: 'p' }));

describe('importer settle', () => {
  it('moves a page under its parent and writes its link once they arrive in a later flush', async () => {
    const { page, start } = setup();
    const { flush } = await start();
    expect(
      await flush([upsert({ sourceId: 'c1', parent: 'p1', links: [{ sourceId: 'p1', rel: 'up' }] })]),
    ).toMatchObject({ created: 1, pending: false });
    expect((await page('notion/c1'))?.body).toBe('body of c1');

    expect(await flush([upsert({ sourceId: 'p1' })])).toMatchObject({
      created: 1,
      moved: 1,
      updated: 1,
      pending: false,
    });
    expect(await page('notion/c1')).toBeNull();
    expect((await page('notion/p1/c1'))?.body).toBe('body of c1\n\nLinks:\n- up: [[docs:acme#notion/p1]]');

    // Upserting the same item again renders the same body: nothing changes.
    expect(
      await flush([upsert({ sourceId: 'c1', parent: 'p1', links: [{ sourceId: 'p1', rel: 'up' }] })]),
    ).toMatchObject({ unchanged: 1, updated: 0, moved: 0 });
  });

  it('reindexes a page a settle slice moved and whose own links it rewrote', async () => {
    const { knowledge, page, start } = setup();
    const { flush } = await start();
    // b waits for p and links to c, which sits under b: moving b moves c's path too.
    await flush([
      upsert({ sourceId: 'b', parent: 'p', links: [{ sourceId: 'c' }] }),
      upsert({ sourceId: 'c', parent: 'b' }),
    ]);
    expect((await page('notion/b'))?.body).toBe('body of b\n\nLinks:\n- [[docs:acme#notion/b/c]]');
    const storage = await knowledge.getStorage();
    const result = await storage.transaction(async tx => {
      const binding = (await tx.importers!.getBinding('b1'))!;
      const [scope] = await tx.getScopesByAddress(['docs:acme']);
      return applyKnowledgeImportFlush({
        storage: tx,
        importers: tx.importers!,
        binding,
        scope: scope!,
        runId: 'r',
        ops: [upsert({ sourceId: 'p' })],
        provenance: { author: 'test' },
        settle: { after: null, candidates: 200, moves: 50, until: Date.now() + 10_000 },
      });
    });
    const moved = await page('notion/p/b');
    expect(moved?.body).toBe('body of b\n\nLinks:\n- [[docs:acme#notion/p/b/c]]');
    expect(result.embeds).toContainEqual({ kind: 'index', pageId: moved!.id });
    expect(result.counts).toMatchObject({ created: 1, moved: 1, updated: 1 });
  });

  it('settles at most 50 moves per flush, and empty flushes carry on until the pass ends', async () => {
    const { page, start } = setup();
    const { flush } = await start();
    await flush(children(120));
    expect(await flush([upsert({ sourceId: 'p' })])).toMatchObject({ created: 1, moved: 50, pending: true });
    expect(await flush([])).toMatchObject({ moved: 50, pending: true });
    expect(await flush([])).toMatchObject({ moved: 20, pending: false });
    expect(await page('notion/p/c119')).not.toBeNull();
    expect(await page('notion/c000')).toBeNull();
    expect(await flush([])).toMatchObject({ moved: 0, created: 0, pending: false });
  });

  it('stops a slice at its candidate and time caps and resumes where it stopped', async () => {
    const { knowledge, start } = setup();
    const { flush } = await start();
    await flush(children(5));
    await flush([upsert({ sourceId: 'p' })]);
    const storage = await knowledge.getStorage();
    const slice = (budget: { after: string | null; candidates: number; until: number }) =>
      storage.transaction(async tx => {
        const binding = (await tx.importers!.getBinding('b1'))!;
        const [scope] = await tx.getScopesByAddress(['docs:acme']);
        return (
          await applyKnowledgeImportFlush({
            storage: tx,
            importers: tx.importers!,
            binding,
            scope: scope!,
            runId: 'r',
            ops: [],
            provenance: { author: 'test' },
            settle: { ...budget, moves: 50 },
          })
        ).settle;
      });
    // Already settled by the flush that brought the parent; put some back.
    for (const id of ['c001', 'c002', 'c003']) {
      const node = (await storage.importers!.getNode('b1', id))!;
      await storage.importers!.saveNode({ ...node, unsettled: true });
    }
    expect(await slice({ after: null, candidates: 10, until: Date.now() - 1 })).toEqual({
      pending: true,
      cursor: null,
      settled: 0,
      fromStart: true,
    });
    expect(await slice({ after: null, candidates: 2, until: Date.now() + 10_000 })).toEqual({
      pending: true,
      cursor: 'c002',
      settled: 0,
      fromStart: true,
    });
    expect(await slice({ after: 'c002', candidates: 2, until: Date.now() + 10_000 })).toEqual({
      pending: false,
      cursor: null,
      settled: 0,
      fromStart: false,
    });
    expect((await storage.importers!.listNodes('b1', { unsettled: true })).items).toEqual([]);
  });

  it('chains on settle work left only when settling made progress, and replays both decisions', async () => {
    const { start } = setup();
    const first = await start();
    await first.flush(children(60));
    const receipt = await first.flush([upsert({ sourceId: 'p' })]);
    expect(receipt).toMatchObject({ moved: 50, pending: true });
    const finished = await first.finish();
    expect(finished).toMatchObject({ backlog: false, chain: true });
    expect(await first.finish()).toEqual(finished);

    // A run whose items wait on a parent that never arrives: nothing to chain on.
    const second = await start();
    expect(await second.flush([upsert({ sourceId: 'orphan', parent: 'never' })])).toMatchObject({ pending: false });
    expect(await second.finish()).toMatchObject({ chain: false });
  });

  it('a run drains its settle work with empty flushes after the importer is done', async () => {
    const { page, run } = setup();
    const receipt = await run([[...children(120), upsert({ sourceId: 'p' })]]);
    expect(receipt).toMatchObject({ outcome: 'succeeded', chain: false, counts: { created: 121 } });
    expect(await page('notion/p/c000')).not.toBeNull();
    expect(await page('notion/p/c119')).not.toBeNull();
  });

  it('a parent that never arrives finishes one run without a chain', async () => {
    const { run } = setup();
    expect(await run([[upsert({ sourceId: 'orphan', parent: 'never' })]])).toMatchObject({
      outcome: 'succeeded',
      chain: false,
    });
  });

  it('stops settling after three settle flushes in a row time out, and then does not chain', async () => {
    const { knowledge, page, start } = setup();
    const { started, flush } = await start();
    await flush(children(120));
    expect(await flush([upsert({ sourceId: 'p' })])).toMatchObject({ moved: 50, pending: true });

    const storage = await knowledge.getStorage();
    const transaction = storage.transaction.bind(storage);
    let failing = true;
    // The settle slice does its work and then runs out of time, as on Postgres: rolled back.
    (storage as { transaction: typeof storage.transaction }).transaction = (async (work: any, options: any) =>
      transaction(async (tx: any) => {
        const result = await work(tx);
        if (failing && result && typeof result === 'object' && 'pending' in result) {
          throw new KnowledgeTransactionDeadlineError();
        }
        return result;
      }, options)) as typeof storage.transaction;

    const ops: KnowledgeImporterOp[] = [];
    const digest = await knowledgeImporterFlushDigest({ ops });
    const resend = () =>
      knowledge.importers!.host.flush({ runId: started.runId, generation: started.generation, seq: 3, digest, ops });
    const timeouts: string[] = [];
    for (let i = 0; i < 3; i++) {
      await expect(resend()).rejects.toMatchObject({ status: 503 });
      timeouts.push((await storage.importers!.getState('b1'))['mastra:settle:timeouts']!);
    }
    expect(timeouts).toEqual([1, 2, 3].map(n => `${started.runId}:${n}`));
    expect(await page('notion/c119')).not.toBeNull();

    failing = false;
    // Settling is off for the rest of the run: the slice that timed out three times isn't tried again.
    expect(await resend()).toMatchObject({ seq: 3, moved: 0, pending: false });
    expect(
      await knowledge.importers!.host.finishRun({
        runId: started.runId,
        generation: started.generation,
        outcome: 'succeeded',
        backlog: false,
        lastSeq: 3,
      }),
    ).toMatchObject({ chain: false });
  });

  it('does not count a timeout that came before the settle slice started', async () => {
    const { knowledge, start } = setup();
    const { started, flush } = await start();
    await flush(children(60));
    const storage = await knowledge.getStorage();
    const transaction = storage.transaction.bind(storage);
    let failing = true;
    (storage as { transaction: typeof storage.transaction }).transaction = (async (work: any, options: any) => {
      // Times out waiting for a lock, before any of the flush ran.
      if (failing && options?.deadlineAt) throw new KnowledgeTransactionDeadlineError();
      return transaction(work, options);
    }) as typeof storage.transaction;
    const ops = [upsert({ sourceId: 'p' })];
    const digest = await knowledgeImporterFlushDigest({ ops });
    const send = () =>
      knowledge.importers!.host.flush({ runId: started.runId, generation: started.generation, seq: 2, digest, ops });
    for (let i = 0; i < 3; i++) await expect(send()).rejects.toMatchObject({ status: 503 });
    expect((await storage.importers!.getState('b1'))['mastra:settle:timeouts']).toBeUndefined();
    failing = false;
    expect(await send()).toMatchObject({ created: 1, moved: 50, pending: true });
  });

  it("keeps the host's own state out of the importer's reach", async () => {
    const { host, start } = setup();
    const { started, flush, finish } = await start();
    await flush([...children(60), upsert({ sourceId: 'p' })]);
    await flush([]);
    const ops: KnowledgeImporterOp[] = [];
    const state = { 'mastra:settle:cursor': 'z' };
    await expect(
      host.flush({
        runId: started.runId,
        generation: started.generation,
        seq: 3,
        digest: await knowledgeImporterFlushDigest({ ops, state }),
        ops,
        state,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await finish();
    const next = await host.startRun('b1');
    if (next.status !== 'started') throw new Error('not started');
    expect(next.state).toEqual({});
  });
});

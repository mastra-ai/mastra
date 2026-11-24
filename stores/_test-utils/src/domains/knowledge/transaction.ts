import type { KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgePageKeyConflictError } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Stand-in importer rows for the transaction contract: a node map, a cursor, flush receipts and a run
 * sequence, written with the adapter's own SQL through the transaction view `tx`. They are what an
 * importer flush has to commit together with its page writes.
 */
export interface KnowledgeTransactionImporterRows {
  /** Creates the stand-in tables if needed and empties them. */
  reset(): Promise<void>;
  startRun(runId: string): Promise<void>;
  receipt(tx: KnowledgeStorage, runId: string, seq: number): Promise<{ digest: string; applied: number } | null>;
  /** The run's last committed seq, locked for the rest of the transaction where the store can lock rows. */
  lastSeq(tx: KnowledgeStorage, runId: string): Promise<number>;
  addNode(tx: KnowledgeStorage, sourceId: string, pageId: string): Promise<void>;
  setCursor(tx: KnowledgeStorage, cursor: string): Promise<void>;
  addReceipt(tx: KnowledgeStorage, runId: string, seq: number, digest: string, applied: number): Promise<void>;
  setLastSeq(tx: KnowledgeStorage, runId: string, seq: number): Promise<void>;
  /** The rows as a separate connection sees them. */
  observe(
    runId: string,
  ): Promise<{ nodes: string[]; cursor: string | null; receipts: number[]; lastSeq: number | null }>;
}

export interface KnowledgeTransactionFixture {
  /** The store whose `transaction` is under test, initialized. */
  store: KnowledgeStorage;
  /** A second store on its own connection to the same database, as another process sees it. */
  reader: KnowledgeStorage;
  rows: KnowledgeTransactionImporterRows;
  cleanup(): Promise<void>;
}

const who = { author: 'importer:test' };

interface Flush {
  runId: string;
  seq: number;
  digest: string;
  pages: { key: string; name: string; sourceId: string }[];
  cursor: string;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

/**
 * r347 O0: one importer flush commits its page writes and its importer rows (node map, cursor, flush
 * receipt, run sequence) in one transaction, or none of them, so a crash never leaves pages the
 * cursor has moved past or a receipt for writes that didn't land.
 */
export function createKnowledgeTransactionTests(createFixture: () => Promise<KnowledgeTransactionFixture>): void {
  describe('knowledge transaction contract (importer flush)', () => {
    let fixture: KnowledgeTransactionFixture;
    let scopeId: string;
    let runId: string;
    let run = 0;

    beforeAll(async () => {
      fixture = await createFixture();
    });
    afterAll(async () => {
      await fixture?.cleanup();
    });
    beforeEach(async () => {
      await fixture.store.dangerouslyClearAll();
      await fixture.rows.reset();
      const { scope } = await fixture.store.materializeScope({
        address: 'org:acme',
        declaration: 'org:$orgId',
        name: 'Acme',
        provenance: who,
      });
      scopeId = scope.id;
      runId = `run-${++run}`;
      await fixture.rows.startRun(runId);
    });

    /** What the local importer host does per flush, reduced to the writes that must be atomic. */
    const flush = (
      input: Flush,
      hooks: { afterPageWrite?: () => Promise<void>; beforeCommit?: () => Promise<void> } = {},
    ) =>
      fixture.store.transaction(async tx => {
        const { rows } = fixture;
        const stored = await rows.receipt(tx, input.runId, input.seq);
        if (stored) {
          if (stored.digest !== input.digest) throw new Error('digest mismatch');
          return { seq: input.seq, applied: stored.applied, replayed: true };
        }
        const lastSeq = await rows.lastSeq(tx, input.runId);
        if (input.seq !== lastSeq + 1) throw new Error(`seq gap: expected ${lastSeq + 1}`);
        for (const item of input.pages) {
          const page = await tx.createPage({ parentId: scopeId, key: item.key, name: item.name, provenance: who });
          await rows.addNode(tx, item.sourceId, page.id);
          await hooks.afterPageWrite?.();
        }
        await rows.setCursor(tx, input.cursor);
        await rows.addReceipt(tx, input.runId, input.seq, input.digest, input.pages.length);
        await rows.setLastSeq(tx, input.runId, input.seq);
        await hooks.beforeCommit?.();
        return { seq: input.seq, applied: input.pages.length, replayed: false };
      });

    const batch = (): Flush => ({
      runId,
      seq: 1,
      digest: 'sha256:aaa',
      cursor: 'cursor-1',
      pages: [
        { key: 'alpha', name: 'Alpha', sourceId: 'src-a' },
        { key: 'beta', name: 'Beta', sourceId: 'src-b' },
      ],
    });

    /** Everything a flush can change, read from outside the transaction. */
    const observed = async (keys = ['alpha', 'beta']) => ({
      pages: await Promise.all(
        keys.map(async key => (await fixture.reader.getPageByPath({ scopeId, path: [key], read: 'all' }))?.key ?? null),
      ),
      ...(await fixture.rows.observe(runId)),
    });
    const nothing = { pages: [null, null], nodes: [], cursor: null, receipts: [], lastSeq: 0 };
    const everything = {
      pages: ['alpha', 'beta'],
      nodes: ['src-a', 'src-b'],
      cursor: 'cursor-1',
      receipts: [1],
      lastSeq: 1,
    };

    it('reports that it supports transactions', () => {
      expect(fixture.store.getCapabilities().supportsTransactions).toBe(true);
    });

    it('a second reader sees none of a flush before it commits, and all of it after', async () => {
      const written = deferred();
      const release = deferred();
      const pending = flush(batch(), {
        beforeCommit: async () => {
          written.resolve();
          await release.promise;
        },
      });
      await written.promise;
      expect(await observed()).toEqual(nothing);
      release.resolve();
      expect(await pending).toEqual({ seq: 1, applied: 2, replayed: false });
      expect(await observed()).toEqual(everything);
    });

    it('an abort after a page write leaves no page, node, cursor, receipt or sequence change', async () => {
      await expect(
        flush(batch(), {
          afterPageWrite: async () => {
            throw new Error('crash after the page write');
          },
        }),
      ).rejects.toThrow('crash after the page write');
      expect(await observed()).toEqual(nothing);
    });

    it('a retry of the same (runId, seq, digest) after an abort applies once; a replay returns its receipt', async () => {
      await expect(
        flush(batch(), {
          beforeCommit: async () => {
            throw new Error('ack lost');
          },
        }),
      ).rejects.toThrow('ack lost');
      expect(await flush(batch())).toEqual({ seq: 1, applied: 2, replayed: false });
      expect(await flush(batch())).toEqual({ seq: 1, applied: 2, replayed: true });
      await expect(flush({ ...batch(), digest: 'sha256:other' })).rejects.toThrow('digest mismatch');
      expect(await observed()).toEqual(everything);
    });

    it('a refused page write inside a flush undoes only itself, and the rest of the flush commits', async () => {
      // An importer meeting a page a person wrote at its target path skips that page and goes on.
      await fixture.store.createPage({ parentId: scopeId, key: 'beta', name: 'Written by a person', provenance: who });
      const refused: string[] = [];
      await fixture.store.transaction(async tx => {
        for (const item of batch().pages) {
          try {
            const page = await tx.createPage({ parentId: scopeId, key: item.key, name: item.name, provenance: who });
            await fixture.rows.addNode(tx, item.sourceId, page.id);
          } catch (error) {
            if (!(error instanceof KnowledgePageKeyConflictError)) throw error;
            refused.push(item.key);
          }
        }
        await fixture.rows.setCursor(tx, 'cursor-1');
      });
      expect(refused).toEqual(['beta']);
      const kept = await fixture.reader.getPageByPath({ scopeId, path: ['beta'], read: 'all' });
      expect(kept?.name).toBe('Written by a person');
      expect(await observed()).toMatchObject({ pages: ['alpha', 'beta'], nodes: ['src-a'], cursor: 'cursor-1' });
    });

    it('a transaction started inside a transaction joins it', async () => {
      await expect(
        fixture.store.transaction(async tx => {
          await tx.transaction(inner =>
            inner.createPage({ parentId: scopeId, key: 'alpha', name: 'A', provenance: who }),
          );
          throw new Error('roll back the outer one');
        }),
      ).rejects.toThrow('roll back the outer one');
      expect((await observed()).pages).toEqual([null, null]);
    });
  });
}

const OUTSIDE_TRANSACTIONS = new Set<PropertyKey>([
  'init',
  'dangerouslyClearAll',
  'dangerouslyReset',
  'inspectSchema',
  'getCapabilities',
  'getStorageIsolationKey',
  'transaction',
]);

/**
 * `store` with every page-store call made on a fresh transaction view, so the page-store contract
 * also covers each method running inside `transaction` (and a failed one leaving the view usable).
 */
export function knowledgeStoreThroughTransactions<T extends KnowledgeStorage>(store: T): T {
  return new Proxy(store, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function' || OUTSIDE_TRANSACTIONS.has(property)) {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (...args: unknown[]) =>
        target.transaction(tx =>
          (Reflect.get(tx, property, tx) as (...a: unknown[]) => Promise<unknown>).apply(tx, args),
        );
    },
  });
}

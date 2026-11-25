import { describe, expect, it, onTestFinished } from 'vitest';
import { InMemoryStore } from '../../storage';
import { MastraVector } from '../../vector';
import type { MastraEmbeddingModel, QueryResult } from '../../vector';
import { Knowledge } from '../index';
import { KnowledgeSemanticIndex } from '../semantic';
import { KnowledgeImporter } from './define';
import type { KnowledgeImporterContext } from './define';
import { knowledgeImporterFlushDigest } from './host';
import type { KnowledgeImporterOp } from './types';

/**
 * Indexing after an importer flush commits (r347 O3 §E″). Vector stores have no compare-and-set,
 * so a slow embed of an older version can publish after a newer one; the job re-reads the page
 * after publishing and re-embeds when it moved on, so the index converges on the latest text.
 */

/** Keeps the text each stored vector was embedded from. */
class TextVector extends MastraVector {
  rows = new Map<string, string>();
  indexes = new Set<string>();
  constructor(private texts: string[]) {
    super({ id: 'text' });
  }
  async upsert({ ids, vectors }: any): Promise<string[]> {
    ids.forEach((id: string, i: number) => this.rows.set(id, this.texts[vectors[i][0]]!));
    return ids;
  }
  async deleteVectors({ ids }: any): Promise<void> {
    for (const id of ids ?? []) this.rows.delete(id);
  }
  async createIndex({ indexName }: any): Promise<void> {
    this.indexes.add(indexName);
  }
  async listIndexes(): Promise<string[]> {
    return [...this.indexes];
  }
  async query(): Promise<QueryResult[]> {
    return [];
  }
  async describeIndex(): Promise<any> {
    return { dimension: 2, count: this.rows.size, metric: 'cosine' };
  }
  async deleteIndex(): Promise<void> {}
  async updateVector(): Promise<void> {}
  async deleteVector(): Promise<void> {}
}

function setup() {
  const texts: string[] = [];
  let hold: { match: string; reached: () => void; released: Promise<void> } | undefined;
  const embedder = {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'text',
    maxEmbeddingsPerCall: 1,
    supportsParallelCalls: true,
    doEmbed: async ({ values }: { values: string[] }) => {
      const h = hold;
      if (h && values.some(v => v.includes(h.match))) {
        hold = undefined;
        h.reached();
        await h.released;
      }
      return { embeddings: values.map(v => [texts.push(v) - 1, 0]) };
    },
  } as unknown as MastraEmbeddingModel<string>;
  const vector = new TextVector(texts);
  let ops: KnowledgeImporterOp[] = [];
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    vector,
    embedder,
    scopes: { 'docs:$orgId': {} },
    importers: [
      new (class extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
        async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
          for (const op of ops) if (op.op === 'upsert') await ctx.items.upsert(op.item);
        }
      })({ id: 'b1', target: 'docs:acme#notion' }),
    ],
  });
  /** The next embed whose text contains `match` waits until `release` is called. */
  const holdEmbed = (match: string) => {
    let reached!: () => void;
    let release!: () => void;
    const reachedP = new Promise<void>(resolve => (reached = resolve));
    hold = { match, reached, released: new Promise<void>(resolve => (release = resolve)) };
    return { reached: reachedP, release };
  };
  const setOps = (next: KnowledgeImporterOp[]) => (ops = next);
  return { knowledge, vector, holdEmbed, setOps };
}

describe('importer flush indexing', () => {
  it('converges on the newest text when an older embed publishes after a newer one', async () => {
    const { knowledge, vector, holdEmbed } = setup();
    const host = knowledge.importers!.host;
    const started = await host.startRun('b1');
    if (started.status !== 'started') throw new Error('not started');
    const ops: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'first text' } }];

    const held = holdEmbed('first text');
    const flushing = host.flush({
      runId: started.runId,
      generation: started.generation,
      seq: 1,
      digest: await knowledgeImporterFlushDigest({ ops }),
      ops,
    });
    await held.reached;
    // A newer write lands and is indexed while the flush's embed of the older text is stuck.
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'notion/p1', name: 'P1', body: 'second text' });
    expect([...vector.rows.values()].some(t => t.includes('second text'))).toBe(true);

    held.release();
    expect(await flushing).toMatchObject({ seq: 1, created: 1 });
    const indexed = [...vector.rows.values()].filter(t => t.includes('P1'));
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toContain('second text');
  });

  it('returns the receipt of a committed flush when indexing fails', async () => {
    const { knowledge, vector } = setup();
    const host = knowledge.importers!.host;
    vector.upsert = async () => {
      throw new Error('vector store down');
    };
    const delays = KnowledgeSemanticIndex.retryDelaysMs;
    KnowledgeSemanticIndex.retryDelaysMs = [];
    onTestFinished(() => {
      KnowledgeSemanticIndex.retryDelaysMs = delays;
    });
    const started = await host.startRun('b1');
    if (started.status !== 'started') throw new Error('not started');
    const ops: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'text' } }];
    const receipt = await host.flush({
      runId: started.runId,
      generation: started.generation,
      seq: 1,
      digest: await knowledgeImporterFlushDigest({ ops }),
      ops,
    });
    expect(receipt).toMatchObject({ seq: 1, created: 1 });
  });
});

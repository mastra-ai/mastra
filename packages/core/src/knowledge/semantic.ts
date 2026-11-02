import { estimateTokenCount } from 'tokenx';
import type { KnowledgeNote, KnowledgePage, KnowledgeStorage } from '../storage/domains/knowledge';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import { embedV1, embedV2, embedV3, embedV4 } from '../vector/embed';
import { knowledgeBodyChunks, KNOWLEDGE_EMBED_CHUNK_TOKENS } from './page-body';

/** How far one semantic search over-fetches before it stops refilling. */
const MAX_CANDIDATES = 1000;
const OVERFETCH = 4;
const REINDEX_PAGE = 100;
/**
 * Most chunks one page is embedded as (about 200k estimated tokens of body). Past it the rest of
 * the body is found by keyword search only. Bounded so a rewrite can drop the old chunks by id,
 * which every vector store supports, without knowing how many there were.
 */
export const KNOWLEDGE_MAX_PAGE_CHUNKS = 100;

/**
 * Vector ids for a page's chunks: the first keeps the plain `page:<id>` every page had before
 * chunking, the rest are `page:<id>#<n>`.
 */
function pageChunkIds(pageId: string, from = 0, to = KNOWLEDGE_MAX_PAGE_CHUNKS): string[] {
  const ids: string[] = [];
  for (let n = from; n < to; n++) ids.push(n === 0 ? `page:${pageId}` : `page:${pageId}#${n}`);
  return ids;
}

/** A vector hit, before the caller checks the run can read it. @internal */
export type KnowledgeSemanticCandidate = { kind: 'page' | 'note'; id: string };

/**
 * Embeds ordinary pages (name, description, body) and notes into one vector index. A page too long
 * to embed whole goes in as chunks, each led by the page's name and description; search counts a
 * page once, at its best chunk. The index holds
 * ids only: every hit is re-read through the store with the run's read scope before it counts, so a
 * stale or foreign vector can never surface content, and access filtering happens before ranking.
 * Writes index after the store commits; a failed embed only costs recall until `reindex()`.
 * @internal
 */
export class KnowledgeSemanticIndex {
  constructor(
    private readonly vector: MastraVector,
    private readonly embedder: MastraEmbeddingModel<string>,
    private readonly embedderOptions?: MastraEmbeddingOptions,
  ) {}

  async indexPage(page: KnowledgePage): Promise<void> {
    if (page.isScope || page.deletedAt) return this.removePage(page.id);
    const head = [page.name, page.description].filter(Boolean).join('\n');
    const room = Math.max(KNOWLEDGE_EMBED_CHUNK_TOKENS - estimateTokenCount(head) - 1, 1);
    const chunks = page.body ? knowledgeBodyChunks(page.body, room).slice(0, KNOWLEDGE_MAX_PAGE_CHUNKS) : [''];
    const ids = pageChunkIds(page.id, 0, chunks.length);
    const embeddings: number[][] = [];
    for (const chunk of chunks) embeddings.push(await this.#embed([head, chunk].filter(Boolean).join('\n')));
    await this.#store(
      ids,
      embeddings,
      ids.map((_, chunk) => ({ kind: 'page', pageId: page.id, chunk })),
      // A shorter rewrite leaves the old tail chunks behind; drop them.
      pageChunkIds(page.id, chunks.length),
    );
  }

  /** Drops every chunk of a page from the index. */
  async removePage(pageId: string): Promise<void> {
    await this.remove(pageChunkIds(pageId));
  }

  async indexNote(note: KnowledgeNote): Promise<void> {
    if (note.deletedAt) return this.remove([`note:${note.id}`]);
    await this.#store([`note:${note.id}`], [await this.#embed(note.text)], [{ kind: 'note', noteId: note.id }]);
  }

  async remove(ids: string[]): Promise<void> {
    for (const indexName of await this.#indexes()) await this.vector.deleteVectors({ indexName, ids });
  }

  /**
   * The `limit` best candidates `accept` lets through, in vector order. Over-fetches and refills
   * until enough are accepted or the index runs out, so hidden content neither takes result slots
   * nor reorders what's left.
   */
  async search<T>(
    query: string,
    limit: number,
    accept: (candidate: KnowledgeSemanticCandidate) => Promise<T | null>,
  ): Promise<T[]> {
    const embedding = await this.#embed(query);
    const indexName = this.#indexName(embedding.length);
    if (!(await this.#indexes()).includes(indexName)) return [];

    const accepted: T[] = [];
    const seen = new Set<string>();
    for (let topK = limit * OVERFETCH; ; topK = Math.min(topK * OVERFETCH, MAX_CANDIDATES)) {
      const results = await this.vector.query({ indexName, queryVector: embedding, topK });
      for (const result of results) {
        // A page's chunks share one candidate, ranked at the best of them (the first to come back).
        const candidate = result.id.replace(/#\d+$/, '');
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const colon = candidate.indexOf(':');
        const kind = candidate.slice(0, colon);
        if (kind !== 'page' && kind !== 'note') continue;
        const hit = await accept({ kind, id: candidate.slice(colon + 1) });
        if (hit !== null) accepted.push(hit);
        if (accepted.length >= limit) return accepted;
      }
      if (results.length < topK || topK >= MAX_CANDIDATES) return accepted;
    }
  }

  /**
   * Re-embeds every live ordinary page and every live note in the store, including notes on scope
   * pages (scope pages themselves aren't embedded). Returns how many were indexed.
   */
  async reindex(storage: KnowledgeStorage): Promise<number> {
    let count = 0;
    const indexNotesOn = async (pageId: string) => {
      let cursor: string | undefined;
      do {
        const { notes, nextCursor } = await storage.listNotes({ pageId, read: 'all', cursor, limit: REINDEX_PAGE });
        for (const note of notes) {
          await this.indexNote(note);
          count++;
        }
        cursor = nextCursor;
      } while (cursor);
    };

    // listPages leaves scope pages out, so walk the scope tree for the notes written on them.
    const scopeParents: Array<string | null> = [null];
    while (scopeParents.length) {
      const parentId = scopeParents.pop()!;
      let cursor: string | undefined;
      do {
        const { pages, nextCursor } = await storage.listChildScopes({ parentId, cursor, limit: REINDEX_PAGE });
        for (const scope of pages) {
          await indexNotesOn(scope.id);
          scopeParents.push(scope.id);
        }
        cursor = nextCursor;
      } while (cursor);
    }

    let cursor: string | undefined;
    do {
      const { pages, nextCursor } = await storage.listPages({ read: 'all', cursor, limit: REINDEX_PAGE });
      for (const page of pages) {
        await this.indexPage(page);
        count++;
        await indexNotesOn(page.id);
      }
      cursor = nextCursor;
    } while (cursor);
    return count;
  }

  /** Through the SDK's `embed`, so `maxRetries`, `headers`, `providerOptions` and `telemetry` mean what they do elsewhere. */
  async #embed(value: string): Promise<number[]> {
    const model = this.embedder;
    const { maxRetries, headers, providerOptions, telemetry } = this.embedderOptions ?? {};
    const options = { value, maxRetries, headers, providerOptions, experimental_telemetry: telemetry } as any;
    let embedding: number[] | undefined;
    if (model.specificationVersion === 'v4') embedding = (await embedV4({ ...options, model })).embedding;
    else if (model.specificationVersion === 'v3') embedding = (await embedV3({ ...options, model })).embedding;
    else if (model.specificationVersion === 'v2') embedding = (await embedV2({ ...options, model })).embedding;
    else embedding = (await embedV1({ ...options, model })).embedding;
    if (!embedding?.length) throw new Error('Knowledge embedder returned no vector.');
    return embedding;
  }

  async #store(
    ids: string[],
    embeddings: number[][],
    metadata: Array<Record<string, string | number>>,
    stale: string[] = [],
  ): Promise<void> {
    const indexName = this.#indexName(embeddings[0]!.length);
    const indexes = await this.#indexes();
    if (!indexes.includes(indexName)) await this.vector.createIndex({ indexName, dimension: embeddings[0]!.length });
    // A changed embedder dimension leaves the old copy in another index; drop it there.
    for (const other of indexes)
      if (other !== indexName) await this.vector.deleteVectors({ indexName: other, ids: [...ids, ...stale] });
    if (stale.length && indexes.includes(indexName)) await this.vector.deleteVectors({ indexName, ids: stale });
    await this.vector.upsert({ indexName, ids, vectors: embeddings, metadata });
  }

  async #indexes(): Promise<string[]> {
    const prefix = this.#prefix();
    return (await this.vector.listIndexes()).filter(index => index.startsWith(prefix));
  }

  #prefix(): string {
    const separator = this.vector.indexSeparator ?? '_';
    return `knowledge${separator}pages${separator}dimension${separator}`;
  }

  #indexName(dimension: number): string {
    return `${this.#prefix()}${dimension}`;
  }
}

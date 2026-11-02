import type { KnowledgeNote, KnowledgePage, KnowledgeStorage } from '../storage/domains/knowledge';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import { embedV1, embedV2, embedV3, embedV4 } from '../vector/embed';

/** How far one semantic search over-fetches before it stops refilling. */
const MAX_CANDIDATES = 1000;
const OVERFETCH = 4;
const REINDEX_PAGE = 100;

/** A vector hit, before the caller checks the run can read it. @internal */
export type KnowledgeSemanticCandidate = { kind: 'page' | 'note'; id: string };

/**
 * Embeds ordinary pages (name, description, body) and notes into one vector index. The index holds
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
    if (page.isScope || page.deletedAt) return this.remove([`page:${page.id}`]);
    const text = [page.name, page.description, page.body].filter(Boolean).join('\n');
    await this.#upsert(`page:${page.id}`, text, { kind: 'page', pageId: page.id });
  }

  async indexNote(note: KnowledgeNote): Promise<void> {
    if (note.deletedAt) return this.remove([`note:${note.id}`]);
    await this.#upsert(`note:${note.id}`, note.text, { kind: 'note', noteId: note.id });
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
        if (seen.has(result.id)) continue;
        seen.add(result.id);
        const colon = result.id.indexOf(':');
        const kind = result.id.slice(0, colon);
        if (kind !== 'page' && kind !== 'note') continue;
        const hit = await accept({ kind, id: result.id.slice(colon + 1) });
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

  async #upsert(id: string, text: string, metadata: Record<string, string>): Promise<void> {
    const embedding = await this.#embed(text);
    const indexName = this.#indexName(embedding.length);
    const indexes = await this.#indexes();
    if (!indexes.includes(indexName)) await this.vector.createIndex({ indexName, dimension: embedding.length });
    // A changed embedder dimension leaves the old copy in another index; drop it there.
    for (const other of indexes)
      if (other !== indexName) await this.vector.deleteVectors({ indexName: other, ids: [id] });
    await this.vector.upsert({ indexName, ids: [id], vectors: [embedding], metadata: [metadata] });
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

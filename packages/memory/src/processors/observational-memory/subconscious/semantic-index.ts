import type {
  KnowledgeScopeIds,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStorage,
  SearchKnowledgeResult,
} from '@mastra/core/storage';
import { canonicalizeKnowledgeScopeIds, isKnowledgeScopeVisible } from '@mastra/core/storage';

export type KnowledgeSemanticSearchResult = SearchKnowledgeResult & { score: number };
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '@mastra/core/vector';

const DEFAULT_BATCH_SIZE = 50;
const MAX_DRAIN_BATCHES = 100;

export class StaleKnowledgeSemanticIndexError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StaleKnowledgeSemanticIndexError';
  }
}

export interface KnowledgeSemanticIndexCoordinatorConfig {
  knowledge: KnowledgeStorage;
  vector: MastraVector;
  embedder: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  workerId?: string;
  batchSize?: number;
  /** How long another worker's claim must sit before this coordinator may reclaim it. Defaults to the storage adapter's timeout. */
  claimTimeoutMs?: number;
}

interface KnowledgeSemanticDocument {
  text: string;
  name: string;
  scopeIds: KnowledgeScopeIds;
  recordId: string;
  type: KnowledgeSemanticDocumentType;
}

export class KnowledgeSemanticIndexCoordinator {
  readonly #knowledge: KnowledgeStorage;
  readonly #vector: MastraVector;
  readonly #embedder: MastraEmbeddingModel<string>;
  readonly #embedderOptions?: MastraEmbeddingOptions;
  readonly #workerId: string;
  readonly #batchSize: number;
  readonly #claimTimeoutMs: number | undefined;
  readonly #draining = new Map<string, Promise<number>>();

  constructor(config: KnowledgeSemanticIndexCoordinatorConfig) {
    this.#knowledge = config.knowledge;
    this.#vector = config.vector;
    this.#embedder = config.embedder;
    this.#embedderOptions = config.embedderOptions;
    this.#workerId = config.workerId ?? `knowledge-index-${crypto.randomUUID()}`;
    this.#batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.#claimTimeoutMs = config.claimTimeoutMs;
  }

  async drain(scopeIds?: KnowledgeScopeIds): Promise<number> {
    const key = scopeIds?.join('\u001f') ?? '*';
    const active = this.#draining.get(key);
    if (active) return active;
    const draining = this.#drain(scopeIds).finally(() => {
      this.#draining.delete(key);
    });
    this.#draining.set(key, draining);
    return draining;
  }

  async search(query: string, scopeIds: KnowledgeScopeIds, limit = 10): Promise<KnowledgeSemanticSearchResult[]> {
    await this.drain(scopeIds);
    const result = await this.#embedder.doEmbed({
      values: [query],
      ...(this.#embedderOptions ?? {}),
    } as never);
    const embedding = result.embeddings[0];
    if (!embedding?.length) throw new Error('Embedder returned no vector for knowledge search query.');

    const indexName = this.#indexName(embedding.length);
    if (!(await this.#knowledgeIndexes()).includes(indexName)) {
      throw new StaleKnowledgeSemanticIndexError(
        `Knowledge semantic index ${indexName} is unavailable. Capture or index knowledge before searching.`,
      );
    }

    const batches = [await this.#vector.query({ indexName, queryVector: embedding, topK: limit * 4 })];
    const deduped = new Map<string, (typeof batches)[number][number]>();
    for (const candidate of batches.flat()) {
      const candidateScope = candidate.metadata?.scope_ids;
      if (!Array.isArray(candidateScope)) continue;
      let visible = false;
      try {
        visible = isKnowledgeScopeVisible(canonicalizeKnowledgeScopeIds(candidateScope.map(String)), scopeIds);
      } catch {
        continue;
      }
      if (!visible) continue;
      const existing = deduped.get(candidate.id);
      if (!existing || candidate.score > existing.score) deduped.set(candidate.id, candidate);
    }
    // Confirm against storage before ranking so hidden hits cannot crowd visible ones out of the limit.
    const confirmed = await Promise.all(
      [...deduped.values()].map(candidate => this.#toSearchResult(candidate, scopeIds)),
    );
    return confirmed
      .filter((result): result is KnowledgeSemanticSearchResult => result !== null)
      .sort(
        (left, right) =>
          right.score - left.score || `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`),
      )
      .slice(0, limit);
  }

  // Shape semantic hits like lexical SearchKnowledgeResult so callers can join on type + id.
  async #toSearchResult(
    candidate: { id: string; score: number; metadata?: Record<string, unknown> },
    scopeIds: KnowledgeScopeIds,
  ): Promise<KnowledgeSemanticSearchResult | null> {
    const type = candidate.metadata?.document_type;
    if (type === 'node') {
      const node = await this.#knowledge.getNode(candidate.id.slice('knowledge:node:'.length));
      if (!node) return null;
      const nodeScopeIds = await this.#knowledge.getNodeScopeIds(node.id);
      if (!isKnowledgeScopeVisible(nodeScopeIds, scopeIds)) return null;
      return {
        type: 'node',
        id: node.id,
        recordId: node.id,
        name: node.name,
        text: String(candidate.metadata?.text ?? node.name),
        scopeIds: nodeScopeIds,
        score: candidate.score,
      };
    }
    if (type === 'record') {
      const record = await this.#knowledge.getRecord({ id: candidate.id.slice('knowledge:record:'.length) });
      if (!record) return null;
      const recordScopeIds = await this.#knowledge.getRecordScopeIds(record.id);
      if (!isKnowledgeScopeVisible(recordScopeIds, scopeIds)) return null;
      const node = await this.#knowledge.getNode(record.nodeId);
      const nodeVisible = node
        ? isKnowledgeScopeVisible(await this.#knowledge.getNodeScopeIds(node.id), scopeIds)
        : false;
      return {
        type: 'record',
        id: record.id,
        recordId: nodeVisible ? node!.id : record.id,
        name: nodeVisible ? node!.name : '(private node)',
        text: record.text,
        scopeIds: recordScopeIds,
        score: candidate.score,
      };
    }
    return null;
  }

  async #drain(scopeIds?: KnowledgeScopeIds): Promise<number> {
    let processed = 0;
    for (let batch = 0; batch < MAX_DRAIN_BATCHES; batch++) {
      const entries = await this.#knowledge.claimSemanticOutbox({
        workerId: this.#workerId,
        limit: this.#batchSize,
        claimTimeoutMs: this.#claimTimeoutMs,
        scopeIds,
      });
      if (entries.length === 0) {
        const [pending, processing] = await Promise.all([
          this.#knowledge.listSemanticOutbox({ status: 'pending', scopeIds, limit: 1 }),
          this.#knowledge.listSemanticOutbox({ status: 'processing', scopeIds, limit: 1 }),
        ]);
        if (pending.length > 0 || processing.length > 0) {
          throw new StaleKnowledgeSemanticIndexError(
            'Knowledge semantic index is stale: a visible operation is pending or being processed by another worker.',
          );
        }
        return processed;
      }

      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]!;
        try {
          await this.#apply(entry);
          const completed = await this.#knowledge.completeSemanticOutbox({ ids: [entry.id], workerId: this.#workerId });
          // Our claim expired and another worker finished this entry; the write above may have
          // overwritten its newer vector, so re-apply from current storage state to converge.
          // Adapters published before completions were reported return nothing; treat that as held.
          if (Array.isArray(completed) && !completed.includes(entry.id))
            await this.#apply({ ...entry, operation: 'upsert' });
          processed++;
        } catch (error) {
          await this.#knowledge.releaseSemanticOutbox({
            ids: entries.slice(index).map(pendingEntry => pendingEntry.id),
            workerId: this.#workerId,
          });
          throw new StaleKnowledgeSemanticIndexError(
            `Knowledge semantic index is stale because operation ${entry.id} could not be applied.`,
            { cause: error },
          );
        }
      }
    }
    throw new StaleKnowledgeSemanticIndexError(
      `Knowledge semantic index remained stale after ${MAX_DRAIN_BATCHES} processing batches.`,
    );
  }

  async #apply(entry: KnowledgeSemanticOutboxEntry): Promise<void> {
    if (entry.operation === 'delete') {
      await this.#deleteDocument(entry.documentId);
      return;
    }

    const document = await this.#loadDocument(entry);
    if (!document) {
      await this.#deleteDocument(entry.documentId);
      return;
    }
    const result = await this.#embedder.doEmbed({
      values: [document.text],
      ...(this.#embedderOptions ?? {}),
    } as never);
    const embedding = result.embeddings[0];
    if (!embedding?.length) throw new Error(`Embedder returned no vector for ${entry.documentId}`);
    const indexName = this.#indexName(embedding.length);
    const indexes = await this.#knowledgeIndexes();
    if (!indexes.includes(indexName)) {
      await this.#vector.createIndex({ indexName, dimension: embedding.length });
    }
    for (const existingIndex of indexes) {
      if (existingIndex !== indexName) {
        await this.#vector.deleteVectors({ indexName: existingIndex, ids: [entry.documentId] });
      }
    }
    await this.#vector.upsert({
      indexName,
      ids: [entry.documentId],
      vectors: [embedding],
      metadata: [this.#metadata(document)],
    });
  }

  async #loadDocument(entry: KnowledgeSemanticOutboxEntry): Promise<KnowledgeSemanticDocument | null> {
    if (entry.documentType === 'node') {
      const node = await this.#knowledge.getNode(entry.documentId.slice('knowledge:node:'.length));
      if (!node) return null;
      const description = typeof node.metadata?.description === 'string' ? node.metadata.description : undefined;
      return {
        text: description ? `${node.name}\n${description}` : node.name,
        name: node.name,
        scopeIds: await this.#knowledge.getNodeScopeIds(node.id),
        recordId: node.id,
        type: 'node',
      };
    }
    const record = await this.#knowledge.getRecord({
      id: entry.documentId.slice('knowledge:record:'.length),
      includeDeleted: true,
    });
    if (!record || record.deletedAt) return null;
    const node = await this.#knowledge.getNode(record.nodeId);
    if (!node) return null;
    return {
      text: `${node.name}\n${record.text}`,
      name: node.name,
      scopeIds: await this.#knowledge.getRecordScopeIds(record.id),
      recordId: record.id,
      type: 'record',
    };
  }

  async #deleteDocument(documentId: string): Promise<void> {
    for (const indexName of await this.#knowledgeIndexes()) {
      await this.#vector.deleteVectors({ indexName, ids: [documentId] });
    }
  }

  async #knowledgeIndexes(): Promise<string[]> {
    const prefix = `knowledge${this.#vector.indexSeparator ?? '_'}documents`;
    return (await this.#vector.listIndexes()).filter(
      index => index === prefix || index.startsWith(`${prefix}${this.#vector.indexSeparator ?? '_'}dimension`),
    );
  }

  #indexName(dimension: number): string {
    const separator = this.#vector.indexSeparator ?? '_';
    return `knowledge${separator}documents${separator}dimension${separator}${dimension}`;
  }

  #metadata(document: KnowledgeSemanticDocument): Record<string, string | string[]> {
    const metadata: Record<string, string | string[]> = {
      document_type: document.type,
      record_id: document.recordId,
      name: document.name,
      scope_ids: [...document.scopeIds],
      text: document.text,
    };
    return metadata;
  }
}

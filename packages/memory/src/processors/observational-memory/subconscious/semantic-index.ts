import { getKnowledgeReadableScopeIds, type Knowledge } from '@mastra/core/knowledge';
import type {
  KnowledgeScopeIds,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStorage,
} from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '@mastra/core/vector';

const DEFAULT_BATCH_SIZE = 50;
const MAX_DRAIN_BATCHES = 100;
const MIN_SEARCH_CANDIDATES = 50;
const MAX_SEARCH_CANDIDATES = 1_000;

export class StaleKnowledgeSemanticIndexError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StaleKnowledgeSemanticIndexError';
  }
}

export interface KnowledgeSemanticIndexCoordinatorConfig {
  knowledge: Knowledge;
  storage: KnowledgeStorage;
  vector: MastraVector;
  embedder: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  workerId?: string;
  batchSize?: number;
}

interface KnowledgeSemanticDocument {
  text: string;
  name: string;
  scopeIds: KnowledgeScopeIds;
  recordId: string;
  type: KnowledgeSemanticDocumentType;
}

export class KnowledgeSemanticIndexCoordinator {
  readonly #knowledge: Knowledge;
  readonly #storage: KnowledgeStorage;
  readonly #vector: MastraVector;
  readonly #embedder: MastraEmbeddingModel<string>;
  readonly #embedderOptions?: MastraEmbeddingOptions;
  readonly #workerId: string;
  readonly #batchSize: number;
  readonly #draining = new Map<string, Promise<number>>();

  constructor(config: KnowledgeSemanticIndexCoordinatorConfig) {
    this.#knowledge = config.knowledge;
    this.#storage = config.storage;
    this.#vector = config.vector;
    this.#embedder = config.embedder;
    this.#embedderOptions = config.embedderOptions;
    this.#workerId = config.workerId ?? `knowledge-index-${crypto.randomUUID()}`;
    this.#batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
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

  async search(query: string, scopeIds: KnowledgeScopeIds, limit = 10) {
    await this.drain(scopeIds);
    const readableScopeIds = getKnowledgeReadableScopeIds(await this.#knowledge.evaluateAccess(scopeIds));
    if (readableScopeIds.length === 0) return [];
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

    const requestedLimit = Math.max(1, limit);
    const authorized = new Map<string, Awaited<ReturnType<MastraVector['query']>>[number]>();
    const checked = new Set<string>();
    let topK = Math.min(MAX_SEARCH_CANDIDATES, Math.max(MIN_SEARCH_CANDIDATES, requestedLimit * 4));

    while (authorized.size < requestedLimit) {
      const candidates = await this.#vector.query({
        indexName,
        queryVector: embedding,
        topK,
        filter: { scope_ids: { $in: readableScopeIds } },
      });
      for (const candidate of candidates) {
        if (checked.has(candidate.id)) continue;
        checked.add(candidate.id);
        const metadata = await this.#readableCandidateMetadata(candidate, scopeIds, readableScopeIds);
        if (!metadata) continue;
        authorized.set(candidate.id, { ...candidate, metadata });
      }
      if (candidates.length < topK || topK >= MAX_SEARCH_CANDIDATES) break;
      topK = Math.min(MAX_SEARCH_CANDIDATES, topK * 2);
    }

    return [...authorized.values()]
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, requestedLimit);
  }

  async #readableCandidateMetadata(
    candidate: { id: string; metadata?: Record<string, unknown> },
    scopeIds: KnowledgeScopeIds,
    readableScopeIds: KnowledgeScopeIds,
  ): Promise<Record<string, unknown> | null> {
    if (candidate.metadata?.document_type === 'record') {
      const recordId = candidate.id.slice('knowledge:record:'.length);
      const record = await this.#knowledge.getRecord({ id: recordId, scopeIds });
      if (!record) return null;
      const node = await this.#knowledge.getNode({ id: record.nodeId, scopeIds });
      if (!node) return null;
      return {
        document_type: 'record',
        record_id: record.id,
        name: node.name,
        text: `${node.name}\n${record.text}`,
      };
    }
    if (candidate.metadata?.document_type === 'node') {
      const node = await this.#knowledge.getNode({
        id: candidate.id.slice('knowledge:node:'.length),
        scopeIds,
      });
      if (!node) return null;
      const description = typeof node.metadata?.description === 'string' ? node.metadata.description : undefined;
      return {
        document_type: 'node',
        record_id: node.id,
        name: node.name,
        text: description ? `${node.name}\n${description}` : node.name,
      };
    }
    return null;
  }

  async #drain(scopeIds?: KnowledgeScopeIds): Promise<number> {
    let processed = 0;
    for (let batch = 0; batch < MAX_DRAIN_BATCHES; batch++) {
      const entries = scopeIds
        ? await this.#knowledge.claimSemanticOutbox({
            workerId: this.#workerId,
            limit: this.#batchSize,
            scopeIds,
          })
        : await this.#storage.claimSemanticOutbox({ workerId: this.#workerId, limit: this.#batchSize });
      if (entries.length === 0) {
        const [pending, processing] = scopeIds
          ? await Promise.all([
              this.#knowledge.listSemanticOutbox({ status: 'pending', scopeIds, limit: 1 }),
              this.#knowledge.listSemanticOutbox({ status: 'processing', scopeIds, limit: 1 }),
            ])
          : await Promise.all([
              this.#storage.listSemanticOutbox({ status: 'pending', limit: 1 }),
              this.#storage.listSemanticOutbox({ status: 'processing', limit: 1 }),
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
          await this.#knowledge.completeSemanticOutbox({ ids: [entry.id], workerId: this.#workerId });
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
      const node = await this.#storage.getNode(entry.documentId.slice('knowledge:node:'.length));
      if (!node) return null;
      const description = typeof node.metadata?.description === 'string' ? node.metadata.description : undefined;
      return {
        text: description ? `${node.name}\n${description}` : node.name,
        name: node.name,
        scopeIds: await this.#storage.getNodeScopeIds(node.id),
        recordId: node.id,
        type: 'node',
      };
    }
    const record = await this.#storage.getRecord({
      id: entry.documentId.slice('knowledge:record:'.length),
      includeDeleted: true,
    });
    if (!record || record.deletedAt) return null;
    const node = await this.#storage.getNode(record.nodeId);
    if (!node) return null;
    return {
      text: `${node.name}\n${record.text}`,
      name: node.name,
      scopeIds: await this.#storage.getRecordScopeIds(record.id),
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

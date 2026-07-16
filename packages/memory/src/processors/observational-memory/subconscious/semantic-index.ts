import type {
  KnowledgeScope,
  KnowledgeSemanticDocumentType,
  KnowledgeSemanticOutboxEntry,
  KnowledgeStorage,
} from '@mastra/core/storage';
import { canonicalizeKnowledgeScope, isKnowledgeScopeVisible } from '@mastra/core/storage';
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
}

interface KnowledgeSemanticDocument {
  text: string;
  name: string;
  scope: KnowledgeScope;
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
  readonly #draining = new Map<string, Promise<number>>();

  constructor(config: KnowledgeSemanticIndexCoordinatorConfig) {
    this.#knowledge = config.knowledge;
    this.#vector = config.vector;
    this.#embedder = config.embedder;
    this.#embedderOptions = config.embedderOptions;
    this.#workerId = config.workerId ?? `knowledge-index-${crypto.randomUUID()}`;
    this.#batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  async drain(scope?: KnowledgeScope): Promise<number> {
    const key = scope?.join('\u001f') ?? '*';
    const active = this.#draining.get(key);
    if (active) return active;
    const draining = this.#drain(scope).finally(() => {
      this.#draining.delete(key);
    });
    this.#draining.set(key, draining);
    return draining;
  }

  async search(query: string, scope: KnowledgeScope, limit = 10) {
    await this.drain(scope);
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

    const visibleScopeKeys = scope.map((_, index) => scope.slice(0, index + 1).join('\u001f'));
    const batches = await Promise.all(
      visibleScopeKeys.map(scopeKey =>
        this.#vector.query({
          indexName,
          queryVector: embedding,
          topK: limit,
          filter: { scope_key: scopeKey },
        }),
      ),
    );
    const deduped = new Map<string, (typeof batches)[number][number]>();
    for (const candidate of batches.flat()) {
      const candidateScope = candidate.metadata?.scope;
      if (!Array.isArray(candidateScope)) continue;
      let visible = false;
      try {
        visible = isKnowledgeScopeVisible(canonicalizeKnowledgeScope(candidateScope.map(String)), scope);
      } catch {
        continue;
      }
      if (!visible) continue;
      const existing = deduped.get(candidate.id);
      if (!existing || candidate.score > existing.score) deduped.set(candidate.id, candidate);
    }
    return [...deduped.values()]
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, limit);
  }

  async #drain(scope?: KnowledgeScope): Promise<number> {
    let processed = 0;
    for (let batch = 0; batch < MAX_DRAIN_BATCHES; batch++) {
      const entries = await this.#knowledge.claimSemanticOutbox({
        workerId: this.#workerId,
        limit: this.#batchSize,
        scope,
      });
      if (entries.length === 0) {
        const [pending, processing] = await Promise.all([
          this.#knowledge.listSemanticOutbox({ status: 'pending', scope, limit: 1 }),
          this.#knowledge.listSemanticOutbox({ status: 'processing', scope, limit: 1 }),
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
            ids: entries.slice(index).map(item => item.id),
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
    if (entry.documentType === 'entity') {
      const entity = await this.#knowledge.getEntity(entry.documentId.slice('knowledge:entity:'.length));
      if (!entity || entity.mergedInto) return null;
      return {
        text: `${entity.name}\n${entity.kind}`,
        name: entity.name,
        scope: entity.scope,
        recordId: entity.id,
        type: 'entity',
      };
    }
    if (entry.documentType === 'page') {
      const page = await this.#knowledge.getPage(entry.documentId.slice('knowledge:page:'.length));
      if (!page) return null;
      return {
        text: `${page.name}\n${page.body}`,
        name: page.name,
        scope: page.scope,
        recordId: page.id,
        type: 'page',
      };
    }
    const fact = await this.#knowledge.getFact({
      id: entry.documentId.slice('knowledge:fact:'.length),
      includeDeleted: true,
    });
    if (!fact || fact.deletedAt) return null;
    return {
      text: fact.text,
      name: '(fact)',
      scope: fact.scope,
      recordId: fact.id,
      type: 'fact',
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
      scope: [...document.scope],
      scope_key: document.scope.join('\u001f'),
      text: document.text,
    };
    for (const entry of document.scope) {
      const separator = entry.indexOf(':');
      metadata[`scope_${entry.slice(0, separator)}`] = entry.slice(separator + 1);
    }
    return metadata;
  }
}

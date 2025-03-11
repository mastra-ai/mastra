import { MastraVector } from '@mastra/core/vector';
import type {
  CreateIndexParams,
  ParamsToArgs,
  QueryResult,
  QueryVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Index } from '@upstash/vector';

import { UpstashFilterTranslator } from './filter';

export class UpstashVector extends MastraVector {
  private client: Index;

  constructor({ url, token }: { url: string; token: string }) {
    super();
    this.client = new Index({
      url,
      token,
    });
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

    const generatedIds = ids || vectors.map(() => crypto.randomUUID());

    const points = vectors.map((vector, index) => ({
      id: generatedIds[index]!,
      vector,
      metadata: metadata?.[index],
    }));

    await this.client.upsert(points, {
      namespace: indexName,
    });
    return generatedIds;
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new UpstashFilterTranslator();
    return translator.translate(filter);
  }

  async createIndex(..._args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    console.log('No need to call createIndex for Upstash');
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const ns = this.client.namespace(indexName);

    const filterString = this.transformFilter(filter);
    const results = await ns.query({
      topK,
      vector: queryVector,
      includeVectors: includeVector,
      includeMetadata: true,
      ...(filterString ? { filter: filterString } : {}),
    });

    // Map the results to our expected format
    return (results || []).map(result => ({
      id: `${result.id}`,
      score: result.score,
      metadata: result.metadata,
      ...(includeVector && { vector: result.vector || [] }),
    }));
  }

  async listIndexes(): Promise<string[]> {
    const indexes = await this.client.listNamespaces();
    return indexes.filter(Boolean);
  }

  async describeIndex(indexName: string) {
    const info = await this.client.info();

    return {
      dimension: info.dimension,
      count: info.namespaces?.[indexName]?.vectorCount || 0,
      metric: info?.similarityFunction?.toLowerCase() as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.deleteNamespace(indexName);
    } catch (error) {
      console.error('Failed to delete namespace:', error);
    }
  }

  async updateIndexById(
    indexName: string,
    id: string,
    update: {
      vector?: number[];
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new Error('No update data provided');
    }

    // The upstash client throws an exception as: 'This index requires dense vectors' when
    // only metadata is present in the update object.
    if (!update.vector && update.metadata) {
      throw new Error('Both vector and metadata must be provided for an update');
    }

    const updatePayload: any = { id: id };
    if (update.vector) {
      updatePayload.vector = update.vector;
    }
    if (update.metadata) {
      updatePayload.metadata = update.metadata;
    }

    const points = {
      id: updatePayload.id,
      vector: updatePayload.vector,
      metadata: updatePayload.metadata,
    };

    await this.client.upsert(points, {
      namespace: indexName,
    });
  }

  async deleteIndexById(indexName: string, id: string): Promise<void> {
    try {
      await this.client.delete(id, {
        namespace: indexName,
      });
    } catch (error) {
      console.error('Failed to delete index by ID:', error);
    }
  }
}

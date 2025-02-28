import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Pinecone } from '@pinecone-database/pinecone';

import { PineconeFilterTranslator } from './filter';

export class PineconeVector extends MastraVector {
  private client: Pinecone;

  constructor(apiKey: string, environment?: string) {
    super();

    const opts: { apiKey: string; controllerHostUrl?: string } = { apiKey };

    if (environment) {
      opts['controllerHostUrl'] = environment;
    }

    const baseClient = new Pinecone(opts);
    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'pinecone-vector',
        attributes: {
          'vector.type': 'pinecone',
        },
      }) ?? baseClient;
  }

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);

    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    await this.client.createIndex({
      name: indexName,
      dimension: dimension,
      metric: metric,
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

    const index = this.client.Index(indexName);

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: vectorIds[i]!,
      values: vector,
      metadata: metadata?.[i] || {},
    }));

    // Pinecone has a limit of 100 vectors per upsert request
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await index.upsert(batch);
    }

    return vectorIds;
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new PineconeFilterTranslator();
    return translator.translate(filter);
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const index = this.client.Index(indexName);

    const translatedFilter = this.transformFilter(filter) ?? {};

    const results = await index.query({
      vector: queryVector,
      topK,
      filter: translatedFilter,
      includeMetadata: true,
      includeValues: includeVector,
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as Record<string, any>,
      ...(includeVector && { vector: match.values || [] }),
    }));
  }

  async listIndexes(): Promise<string[]> {
    const indexesResult = await this.client.listIndexes();
    return indexesResult?.indexes?.map(index => index.name) || [];
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const index = this.client.Index(indexName);
    const stats = await index.describeIndexStats();
    const description = await this.client.describeIndex(indexName);

    return {
      dimension: description.dimension,
      count: stats.totalRecordCount || 0,
      metric: description.metric as 'cosine' | 'euclidean' | 'dotproduct',
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.deleteIndex(indexName);
    } catch (error: any) {
      throw new Error(`Failed to delete Pinecone index: ${error.message}`);
    }
  }
}

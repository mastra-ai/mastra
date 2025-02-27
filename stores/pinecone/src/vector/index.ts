import type { Filter } from '@mastra/core/filter';
import { MastraVector } from '@mastra/core/vector';
import type { QueryResult, IndexStats } from '@mastra/core/vector';
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

  async createIndex(
    indexName: string,
    dimension: number,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine',
  ): Promise<void> {
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

  async upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]> {
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

  transformFilter(filter?: Filter) {
    const pineconeFilter = new PineconeFilterTranslator();
    const translatedFilter = pineconeFilter.translate(filter);
    return translatedFilter;
  }

  async query(
    indexName: string,
    queryVector: number[],
    topK: number = 10,
    filter?: Filter,
    includeVector: boolean = false,
  ): Promise<QueryResult[]> {
    const index = this.client.Index(indexName);

    const translatedFilter = this.transformFilter(filter);

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

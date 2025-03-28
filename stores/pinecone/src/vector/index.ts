import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  QueryVectorArgs,
  UpsertVectorArgs,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Pinecone } from '@pinecone-database/pinecone';
import type { IndexStatsDescription, UpdateOptions } from '@pinecone-database/pinecone';

import { PineconeFilterTranslator } from './filter';

interface PineconeIndexStats extends IndexStats {
  namespaces?: IndexStatsDescription['namespaces'];
}

interface PineconeQueryVectorParams extends QueryVectorParams {
  namespace?: string;
}

type PineconeQueryVectorArgs = [...QueryVectorArgs, string?];

interface PineconeUpsertVectorParams extends UpsertVectorParams {
  namespace?: string;
}

type PineconeUpsertVectorArgs = [...UpsertVectorArgs, string?];

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

  async upsert(...args: ParamsToArgs<PineconeUpsertVectorParams> | PineconeUpsertVectorArgs): Promise<string[]> {
    const params = this.normalizeArgs<PineconeUpsertVectorParams, PineconeUpsertVectorArgs>('upsert', args, [
      'namespace',
    ]);

    const { indexName, vectors, metadata, ids, namespace } = params;

    const index = this.client.Index(indexName).namespace(namespace || '');

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

  async query(...args: ParamsToArgs<PineconeQueryVectorParams> | PineconeQueryVectorArgs): Promise<QueryResult[]> {
    const params = this.normalizeArgs<PineconeQueryVectorParams, PineconeQueryVectorArgs>('query', args, ['namespace']);

    const { indexName, queryVector, topK = 10, filter, includeVector = false, namespace } = params;

    const index = this.client.Index(indexName).namespace(namespace || '');

    const translatedFilter = this.transformFilter(filter) ?? undefined;

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

  async describeIndex(indexName: string): Promise<PineconeIndexStats> {
    const index = this.client.Index(indexName);
    const stats = await index.describeIndexStats();
    const description = await this.client.describeIndex(indexName);

    return {
      dimension: description.dimension,
      count: stats.totalRecordCount || 0,
      metric: description.metric as 'cosine' | 'euclidean' | 'dotproduct',
      namespaces: stats.namespaces,
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      await this.client.deleteIndex(indexName);
    } catch (error: any) {
      throw new Error(`Failed to delete Pinecone index: ${error.message}`);
    }
  }

  async updateIndexById(
    indexName: string,
    id: string,
    update: {
      vector?: number[];
      metadata?: Record<string, any>;
    },
    namespace?: string,
  ): Promise<void> {
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }

    const index = this.client.Index(indexName).namespace(namespace || '');

    const updateObj: UpdateOptions = { id };

    if (update.vector) {
      updateObj.values = update.vector;
    }

    if (update.metadata) {
      updateObj.metadata = update.metadata;
    }

    await index.update(updateObj);
  }

  async deleteIndexById(indexName: string, id: string, namespace?: string): Promise<void> {
    const index = this.client.Index(indexName).namespace(namespace || '');
    await index.deleteOne(id);
  }
}

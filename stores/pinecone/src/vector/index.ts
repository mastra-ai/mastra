import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { Pinecone } from '@pinecone-database/pinecone';
import type {
  IndexStatsDescription,
  QueryOptions,
  RecordSparseValues,
  UpdateOptions,
} from '@pinecone-database/pinecone';

import { PineconeFilterTranslator } from './filter';

interface PineconeIndexStats extends IndexStats {
  namespaces?: IndexStatsDescription['namespaces'];
}

interface PineconeQueryVectorParams extends QueryVectorParams {
  namespace?: string;
  sparseVector?: RecordSparseValues;
}

interface PineconeUpsertVectorParams extends UpsertVectorParams {
  namespace?: string;
  sparseVectors?: RecordSparseValues[];
}

interface PineconeUpdateVectorParams extends UpdateVectorParams {
  namespace?: string;
}

interface PineconeDeleteVectorParams extends DeleteVectorParams {
  namespace?: string;
}

export class PineconeVector extends MastraVector {
  private client: Pinecone;

  /**
   * Creates a new PineconeVector client.
   * @param apiKey - The API key for Pinecone.
   * @param environment - The environment for Pinecone.
   */
  constructor({ apiKey, environment }: { apiKey: string; environment?: string }) {
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

  get indexSeparator(): string {
    return '-';
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
      throw new Error('Metric must be one of: cosine, euclidean, dotproduct');
    }
    try {
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
    } catch (error: any) {
      // Check for 'already exists' error
      const message = error?.errors?.[0]?.message || error?.message;
      if (
        error.status === 409 ||
        (typeof message === 'string' &&
          (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate')))
      ) {
        // Fetch index info and check dimensions
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      // For any other errors, propagate
      throw error;
    }
  }

  async upsert({
    indexName,
    vectors,
    metadata,
    ids,
    namespace,
    sparseVectors,
  }: PineconeUpsertVectorParams): Promise<string[]> {
    const index = this.client.Index(indexName).namespace(namespace || '');

    // Generate IDs if not provided
    const vectorIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: vectorIds[i]!,
      values: vector,
      ...(sparseVectors?.[i] && { sparseValues: sparseVectors?.[i] }),
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

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    namespace,
    sparseVector,
  }: PineconeQueryVectorParams): Promise<QueryResult[]> {
    const index = this.client.Index(indexName).namespace(namespace || '');

    const translatedFilter = this.transformFilter(filter) ?? undefined;

    const queryParams: QueryOptions = {
      vector: queryVector,
      topK,
      includeMetadata: true,
      includeValues: includeVector,
      filter: translatedFilter,
    };

    // If sparse vector is provided, use hybrid search
    if (sparseVector) {
      queryParams.sparseVector = sparseVector;
    }

    const results = await index.query(queryParams);

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

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<PineconeIndexStats> {
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

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.deleteIndex(indexName);
    } catch (error: any) {
      throw new Error(`Failed to delete Pinecone index: ${error.message}`);
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @param namespace - The namespace of the index (optional).
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, update, namespace }: PineconeUpdateVectorParams): Promise<void> {
    try {
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
    } catch (error: any) {
      throw new Error(`Failed to update vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @param namespace - The namespace of the index (optional).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id, namespace }: PineconeDeleteVectorParams): Promise<void> {
    try {
      const index = this.client.Index(indexName).namespace(namespace || '');
      await index.deleteOne(id);
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }
}

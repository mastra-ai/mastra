import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
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
import { Pinecone } from '@pinecone-database/pinecone';
import type {
  IndexStatsDescription,
  QueryOptions,
  RecordSparseValues,
  UpdateOptions,
} from '@pinecone-database/pinecone';

import { PineconeFilterTranslator } from './filter';
import type { PineconeVectorFilter } from './filter';

interface PineconeIndexStats extends IndexStats {
  namespaces?: IndexStatsDescription['namespaces'];
}

interface PineconeQueryVectorParams extends QueryVectorParams<PineconeVectorFilter> {
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

export class PineconeVector extends MastraVector<PineconeVectorFilter> {
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
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
        throw new Error('Metric must be one of: cosine, euclidean, dotproduct');
      }
    } catch (validationError) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_CREATE_INDEX_INVALID_ARGS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension, metric },
        },
        validationError,
      );
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
      // For any other errors, wrap in MastraError
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_CREATE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
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
    try {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsert(batch);
      }

      return vectorIds;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_UPSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors.length },
        },
        error,
      );
    }
  }

  transformFilter(filter?: PineconeVectorFilter) {
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

    try {
      const results = await index.query(queryParams);

      return results.matches.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as Record<string, any>,
        ...(includeVector && { vector: match.values || [] }),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_QUERY_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, topK },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const indexesResult = await this.client.listIndexes();
      return indexesResult?.indexes?.map(index => index.name) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_LIST_INDEXES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<PineconeIndexStats> {
    try {
      const index = this.client.Index(indexName);
      const stats = await index.describeIndexStats();
      const description = await this.client.describeIndex(indexName);

      return {
        dimension: description.dimension,
        count: stats.totalRecordCount || 0,
        metric: description.metric as 'cosine' | 'euclidean' | 'dotproduct',
        namespaces: stats.namespaces,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_DESCRIBE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.client.deleteIndex(indexName);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_DELETE_INDEX_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
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
    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: 'STORAGE_PINECONE_VECTOR_UPDATE_VECTOR_INVALID_ARGS',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName, id },
      });
    }

    try {
      const index = this.client.Index(indexName).namespace(namespace || '');

      const updateObj: UpdateOptions = { id };

      if (update.vector) {
        updateObj.values = update.vector;
      }

      if (update.metadata) {
        updateObj.metadata = update.metadata;
      }

      await index.update(updateObj);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_UPDATE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
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
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_PINECONE_VECTOR_DELETE_VECTOR_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }
}

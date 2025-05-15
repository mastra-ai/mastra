import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  ParamsToArgs,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Schemas } from '@qdrant/js-client-rest';

import { QdrantFilterTranslator } from './filter';

const BATCH_SIZE = 256;
const DISTANCE_MAPPING: Record<string, Schemas['Distance']> = {
  cosine: 'Cosine',
  euclidean: 'Euclid',
  dotproduct: 'Dot',
};

export class QdrantVector extends MastraVector {
  private client: QdrantClient;

  /**
   * @deprecated Passing url, apiKey, https as positional arguments is deprecated.
   * Use the object parameter instead. This signature will be removed on May 20th, 2025.
   */
  constructor(url: string, apiKey?: string, https?: boolean);
  /**
   * Creates a new QdrantVector client.
   * @param params - An object with url, optional apiKey, and optional https.
   */
  constructor(params: { url: string; apiKey?: string; https?: boolean });
  constructor(
    paramsOrUrl: { url: string; apiKey?: string; https?: boolean } | string,
    apiKey?: string,
    https?: boolean,
  ) {
    super();
    let url: string;
    let key: string | undefined;
    let secure: boolean | undefined;
    if (typeof paramsOrUrl === 'string') {
      // DEPRECATION WARNING
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `Deprecation Warning: Passing url, apiKey, https as positional arguments to QdrantVector constructor is deprecated.\nPlease use an object parameter instead:\n  new QdrantVector({ url, apiKey, https })\nThis signature will be removed on May 20th, 2025.`,
        );
      }
      url = paramsOrUrl;
      key = apiKey;
      secure = https;
    } else {
      url = paramsOrUrl.url;
      key = paramsOrUrl.apiKey;
      secure = paramsOrUrl.https;
    }
    const baseClient = new QdrantClient({
      url,
      apiKey: key,
      https: secure,
    });
    const telemetry = this.__getTelemetry();
    this.client =
      telemetry?.traceClass(baseClient, {
        spanNamePrefix: 'qdrant-vector',
        attributes: {
          'vector.type': 'qdrant',
        },
      }) ?? baseClient;
  }

  async upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams>('upsert', args);

    const { indexName, vectors, metadata, ids } = params;

    const pointIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: pointIds[i],
      vector: vector,
      payload: metadata?.[i] || {},
    }));

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await this.client.upsert(indexName, {
        // @ts-expect-error
        points: batch,
        wait: true,
      });
    }

    return pointIds;
  }

  async createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams>('createIndex', args);

    const { indexName, dimension, metric = 'cosine' } = params;

    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('Dimension must be a positive integer');
    }
    if (!DISTANCE_MAPPING[metric]) {
      throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
    }
    try {
      await this.client.createCollection(indexName, {
        vectors: {
          size: dimension,
          distance: DISTANCE_MAPPING[metric],
        },
      });
    } catch (error: any) {
      const message = error?.message || error?.toString();
      // Qdrant typically returns 409 for existing collection
      if (error?.status === 409 || (typeof message === 'string' && message.toLowerCase().includes('exists'))) {
        // Fetch collection info and check dimension
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
    }
  }

  transformFilter(filter?: VectorFilter) {
    const translator = new QdrantFilterTranslator();
    return translator.translate(filter);
  }

  async query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams>('query', args);

    const { indexName, queryVector, topK = 10, filter, includeVector = false } = params;

    const translatedFilter = this.transformFilter(filter) ?? {};

    const results = (
      await this.client.query(indexName, {
        query: queryVector,
        limit: topK,
        filter: translatedFilter,
        with_payload: true,
        with_vector: includeVector,
      })
    ).points;

    return results.map(match => {
      let vector: number[] = [];
      if (includeVector) {
        if (Array.isArray(match.vector)) {
          // If it's already an array of numbers
          vector = match.vector as number[];
        } else if (typeof match.vector === 'object' && match.vector !== null) {
          // If it's an object with vector data
          vector = Object.values(match.vector).filter(v => typeof v === 'number');
        }
      }

      return {
        id: match.id as string,
        score: match.score || 0,
        metadata: match.payload as Record<string, any>,
        ...(includeVector && { vector }),
      };
    });
  }

  async listIndexes(): Promise<string[]> {
    const response = await this.client.getCollections();
    return response.collections.map(collection => collection.name) || [];
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param params - The parameters for describing an index
   * @param params.indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex(...args: ParamsToArgs<DescribeIndexParams>): Promise<IndexStats> {
    const params = this.normalizeArgs<DescribeIndexParams>('describeIndex', args);
    const { indexName } = params;
    const { config, points_count } = await this.client.getCollection(indexName);

    const distance = config.params.vectors?.distance as Schemas['Distance'];
    return {
      dimension: config.params.vectors?.size as number,
      count: points_count || 0,
      // @ts-expect-error
      metric: Object.keys(DISTANCE_MAPPING).find(key => DISTANCE_MAPPING[key] === distance),
    };
  }

  async deleteIndex(...args: ParamsToArgs<DeleteIndexParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteIndexParams>('deleteIndex', args);
    const { indexName } = params;
    await this.client.deleteCollection(indexName);
  }

  /**
   * @deprecated Use {@link updateVector} instead. This method will be removed on May 20th, 2025.
   *
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateIndexById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: updateIndexById() is deprecated. 
      Please use updateVector() instead. 
      updateIndexById() will be removed on May 20th, 2025.`,
    );
    await this.updateVector({ indexName, id, update });
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector(...args: ParamsToArgs<UpdateVectorParams>): Promise<void> {
    const params = this.normalizeArgs<UpdateVectorParams>('updateVector', args);
    const { indexName, id, update } = params;
    if (!update.vector && !update.metadata) {
      throw new Error('No updates provided');
    }

    const pointId = this.parsePointId(id);

    try {
      // Handle metadata-only update
      if (update.metadata && !update.vector) {
        // For metadata-only updates, use the setPayload method
        await this.client.setPayload(indexName, { payload: update.metadata, points: [pointId] });
        return;
      }

      // Handle vector-only update
      if (update.vector && !update.metadata) {
        await this.client.updateVectors(indexName, {
          points: [
            {
              id: pointId,
              vector: update.vector,
            },
          ],
        });
        return;
      }

      // Handle both vector and metadata update
      if (update.vector && update.metadata) {
        const point = {
          id: pointId,
          vector: update.vector,
          payload: update.metadata,
        };

        await this.client.upsert(indexName, {
          points: [point],
        });
        return;
      }
    } catch (error) {
      console.error(`Failed to update vector by id: ${id} for index name: ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * @deprecated Use {@link deleteVector} instead. This method will be removed on May 20th, 2025.
   *
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteIndexById(indexName: string, id: string): Promise<void> {
    this.logger.warn(
      `Deprecation Warning: deleteIndexById() is deprecated. 
      Please use deleteVector() instead. 
      deleteIndexById() will be removed on May 20th, 2025.`,
    );
    await this.deleteVector({ indexName, id });
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector(...args: ParamsToArgs<DeleteVectorParams>): Promise<void> {
    const params = this.normalizeArgs<DeleteVectorParams>('deleteVector', args);
    const { indexName, id } = params;
    try {
      // Parse the ID - Qdrant supports both string and numeric IDs
      const pointId = this.parsePointId(id);

      // Use the Qdrant client to delete the point from the collection
      await this.client.delete(indexName, {
        points: [pointId],
      });
    } catch (error: any) {
      throw new Error(`Failed to delete vector by id: ${id} for index name: ${indexName}: ${error.message}`);
    }
  }

  /**
   * Parses and converts a string ID to the appropriate type (string or number) for Qdrant point operations.
   *
   * Qdrant supports both numeric and string IDs. This helper method ensures IDs are in the correct format
   * before sending them to the Qdrant client API.
   *
   * @param id - The ID string to parse
   * @returns The parsed ID as either a number (if string contains only digits) or the original string
   *
   * @example
   * // Numeric ID strings are converted to numbers
   * parsePointId("123") => 123
   * parsePointId("42") => 42
   * parsePointId("0") => 0
   *
   * // String IDs containing any non-digit characters remain as strings
   * parsePointId("doc-123") => "doc-123"
   * parsePointId("user_42") => "user_42"
   * parsePointId("abc123") => "abc123"
   * parsePointId("123abc") => "123abc"
   * parsePointId("") => ""
   * parsePointId("uuid-5678-xyz") => "uuid-5678-xyz"
   *
   * @remarks
   * - This conversion is important because Qdrant treats numeric and string IDs differently
   * - Only positive integers are converted to numbers (negative numbers with minus signs remain strings)
   * - The method uses base-10 parsing, so leading zeros will be dropped in numeric conversions
   * - reference: https://qdrant.tech/documentation/concepts/points/?q=qdrant+point+id#point-ids
   */
  private parsePointId(id: string): string | number {
    // Try to parse as number if it looks like one
    if (/^\d+$/.test(id)) {
      return parseInt(id, 10);
    }
    return id;
  }
}

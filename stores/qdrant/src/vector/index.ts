import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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
  DeleteVectorsParams,
} from '@mastra/core/vector';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { QdrantClientParams, Schemas } from '@qdrant/js-client-rest';

import { QdrantFilterTranslator } from './filter';
import type { QdrantVectorFilter } from './filter';

const BATCH_SIZE = 256;
const DISTANCE_MAPPING: Record<string, Schemas['Distance']> = {
  cosine: 'Cosine',
  euclidean: 'Euclid',
  dotproduct: 'Dot',
};

type QdrantQueryVectorParams = QueryVectorParams<QdrantVectorFilter>;

export class QdrantVector extends MastraVector {
  private client: QdrantClient;

  /**
   * Creates a new QdrantVector client.
   * @param id - The unique identifier for this vector store instance.
   * @param url - The URL of the Qdrant server.
   * @param apiKey - The API key for Qdrant.
   * @param https - Whether to use HTTPS.
   */
  constructor({ id, ...qdrantParams }: QdrantClientParams & { id: string }) {
    super({ id });
    this.client = new QdrantClient(qdrantParams);
  }

  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    const pointIds = ids || vectors.map(() => crypto.randomUUID());

    const records = vectors.map((vector, i) => ({
      id: pointIds[i],
      vector: vector,
      payload: metadata?.[i] || {},
    }));

    try {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await this.client.upsert(indexName, {
          // @ts-expect-error
          points: batch,
          wait: true,
        });
      }

      return pointIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors.length },
        },
        error,
      );
    }
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }
      if (!DISTANCE_MAPPING[metric]) {
        throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
      }
    } catch (validationError) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension, metric },
        },
        validationError,
      );
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

      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  transformFilter(filter?: QdrantVectorFilter) {
    const translator = new QdrantFilterTranslator();
    return translator.translate(filter);
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QdrantQueryVectorParams): Promise<QueryResult[]> {
    const translatedFilter = this.transformFilter(filter) ?? {};

    try {
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
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'QUERY', 'FAILED'),
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
      const response = await this.client.getCollections();
      return response.collections.map(collection => collection.name) || [];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'LIST_INDEXES', 'FAILED'),
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
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const { config, points_count } = await this.client.getCollection(indexName);

      const distance = config.params.vectors?.distance as Schemas['Distance'];
      return {
        dimension: config.params.vectors?.size as number,
        count: points_count || 0,
        // @ts-expect-error
        metric: Object.keys(DISTANCE_MAPPING).find(key => DISTANCE_MAPPING[key] === distance),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'DESCRIBE_INDEX', 'FAILED'),
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
      await this.client.deleteCollection(indexName);
    } catch (error: any) {
      // If the collection doesn't exist, treat it as a no-op (already deleted)
      const errorMessage = error?.message || error?.toString() || '';
      if (
        error?.status === 404 ||
        errorMessage.toLowerCase().includes('not found') ||
        errorMessage.toLowerCase().includes('not exist')
      ) {
        this.logger.info(`Collection ${indexName} does not exist, treating as already deleted`);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID or multiple vectors matching a filter.
   * @param indexName - The name of the index containing the vector(s).
   * @param id - The ID of the vector to update (mutually exclusive with filter).
   * @param filter - Filter to match multiple vectors to update (mutually exclusive with id).
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, filter, update }: UpdateVectorParams<QdrantVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (id && filter) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both id and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!id && !filter) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'UPDATE_VECTOR', 'NO_TARGET'),
        text: 'Either id or filter must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        text: 'No updates provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: {
          indexName,
          ...(id && { id }),
        },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        text: 'Filter cannot be an empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      if (id) {
        // Update single vector by ID
        const pointId = this.parsePointId(id);

        // Handle metadata-only update
        if (update.metadata && !update.vector) {
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
      } else if (filter) {
        // Update multiple vectors matching filter
        const translatedFilter = this.transformFilter(filter);

        // First, scroll through all matching points to get their IDs
        const matchingPoints: Array<{ id: string | number; vector?: number[] }> = [];
        let offset: string | number | undefined = undefined;

        do {
          const scrollResult = await this.client.scroll(indexName, {
            filter: translatedFilter,
            limit: 100,
            offset,
            with_payload: false,
            with_vector: update.vector ? false : true, // Only fetch vectors if not updating them
          });

          matchingPoints.push(
            ...scrollResult.points.map(point => ({
              id: point.id,
              vector: Array.isArray(point.vector) ? (point.vector as number[]) : undefined,
            })),
          );

          const nextOffset = scrollResult.next_page_offset;
          offset = typeof nextOffset === 'string' || typeof nextOffset === 'number' ? nextOffset : undefined;
        } while (offset !== undefined);

        if (matchingPoints.length === 0) {
          // No vectors to update - this is not an error
          return;
        }

        const pointIds = matchingPoints.map(p => p.id);

        // Handle metadata-only update
        if (update.metadata && !update.vector) {
          await this.client.setPayload(indexName, { payload: update.metadata, points: pointIds });
          return;
        }

        // Handle vector-only or both updates
        if (update.vector) {
          // For vector updates with filter, we need to upsert each point
          const points = matchingPoints.map(p => ({
            id: p.id,
            vector: update.vector!,
            payload: update.metadata || {},
          }));

          // Batch upsert
          for (let i = 0; i < points.length; i += BATCH_SIZE) {
            const batch = points.slice(i, i + BATCH_SIZE);
            await this.client.upsert(indexName, {
              points: batch,
              wait: true,
            });
          }
          return;
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
            ...(filter && { filter: JSON.stringify(filter) }),
          },
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      // Parse the ID - Qdrant supports both string and numeric IDs
      const pointId = this.parsePointId(id);

      // Use the Qdrant client to delete the point from the collection
      await this.client.delete(indexName, {
        points: [pointId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
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

  /**
   * Deletes multiple vectors by IDs or filter.
   * @param indexName - The name of the index containing the vectors.
   * @param ids - Array of vector IDs to delete (mutually exclusive with filter).
   * @param filter - Filter to match vectors to delete (mutually exclusive with ids).
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if both ids and filter are provided, or if neither is provided.
   */
  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<QdrantVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        text: 'Cannot specify both ids and filter - they are mutually exclusive',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'DELETE_VECTORS', 'NO_TARGET'),
        text: 'Either filter or ids must be provided',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate ids array is not empty
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'DELETE_VECTORS', 'EMPTY_IDS'),
        text: 'Cannot delete with empty ids array',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Validate filter is not empty
    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('QDRANT', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        text: 'Cannot delete with empty filter object',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      if (ids) {
        // Delete by IDs - parse all IDs to support both string and numeric formats
        const pointIds = ids.map(id => this.parsePointId(id));
        try {
          await this.client.delete(indexName, {
            points: pointIds,
            wait: true,
          });
        } catch (error: any) {
          // Qdrant throws "Bad Request" when trying to delete non-existent IDs
          // This is expected behavior and should be handled gracefully
          const message = error?.message || error?.toString() || '';
          if (message.toLowerCase().includes('bad request')) {
            // Silently ignore - deleting non-existent IDs is not an error
            return;
          }
          throw error;
        }
      } else if (filter) {
        // Delete by filter
        const translatedFilter = this.transformFilter(filter) ?? {};
        await this.client.delete(indexName, {
          filter: translatedFilter as any,
          wait: true,
        });
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('QDRANT', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}

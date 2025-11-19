import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { EmbeddingModel as EmbeddingModelV1 } from '@internal/ai-sdk-v4';
import { MastraBase } from '../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { VectorFilter } from './filter';
import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  QueryResult,
  UpdateVectorParams,
  DeleteVectorParams,
  DeleteVectorsByFilterParams,
  DescribeIndexParams,
  DeleteIndexParams,
} from './types';

export type MastraEmbeddingModel<T> = EmbeddingModelV1<T> | EmbeddingModelV2<T>;
export abstract class MastraVector<Filter = VectorFilter> extends MastraBase {
  id: string;

  constructor({ id }: { id: string }) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new MastraError({
        id: 'VECTOR_INVALID_ID',
        text: 'Vector id must be provided and cannot be empty',
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
      });
    }
    super({ name: 'MastraVector', component: 'VECTOR' });
    this.id = id;
  }

  get indexSeparator(): string {
    return '_';
  }

  abstract query(params: QueryVectorParams<Filter>): Promise<QueryResult[]>;
  // Adds type checks for positional arguments if used
  abstract upsert(params: UpsertVectorParams): Promise<string[]>;
  // Adds type checks for positional arguments if used
  abstract createIndex(params: CreateIndexParams): Promise<void>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(params: DescribeIndexParams): Promise<IndexStats>;

  abstract deleteIndex(params: DeleteIndexParams): Promise<void>;

  abstract updateVector(params: UpdateVectorParams): Promise<void>;

  abstract deleteVector(params: DeleteVectorParams): Promise<void>;

  /**
   * Delete vectors matching a metadata filter.
   *
   * This enables bulk deletion and source-based vector management.
   * Implementations should throw MastraError with appropriate error code
   * if filter deletion is not supported.
   *
   * @param params - Parameters including indexName and filter
   * @throws {MastraError} If filter deletion is not supported or filter is invalid
   *
   * @example
   * ```ts
   * // Delete all chunks from a document
   * await vectorStore.deleteVectorsByFilter({
   *   indexName: 'docs',
   *   filter: { source_id: 'manual.pdf' }
   * });
   *
   * // Delete old temporary documents
   * await vectorStore.deleteVectorsByFilter({
   *   indexName: 'docs',
   *   filter: {
   *     $and: [
   *       { bucket: 'temp' },
   *       { indexed_at: { $lt: '2025-01-01' } }
   *     ]
   *   }
   * });
   * ```
   */
  abstract deleteVectorsByFilter(params: DeleteVectorsByFilterParams<Filter>): Promise<void>;

  protected async validateExistingIndex(indexName: string, dimension: number, metric: string) {
    let info: IndexStats;
    try {
      info = await this.describeIndex({ indexName });
    } catch (infoError) {
      const mastraError = new MastraError(
        {
          id: 'VECTOR_VALIDATE_INDEX_FETCH_FAILED',
          text: `Index "${indexName}" already exists, but failed to fetch index info for dimension check.`,
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.SYSTEM,
          details: { indexName },
        },
        infoError,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
    }
    const existingDim = info?.dimension;
    const existingMetric = info?.metric;
    if (existingDim === dimension) {
      this.logger?.info(
        `Index "${indexName}" already exists with ${existingDim} dimensions and metric ${existingMetric}, skipping creation.`,
      );
      if (existingMetric !== metric) {
        this.logger?.warn(
          `Attempted to create index with metric "${metric}", but index already exists with metric "${existingMetric}". To use a different metric, delete and recreate the index.`,
        );
      }
    } else if (info) {
      const mastraError = new MastraError({
        id: 'VECTOR_VALIDATE_INDEX_DIMENSION_MISMATCH',
        text: `Index "${indexName}" already exists with ${existingDim} dimensions, but ${dimension} dimensions were requested`,
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: { indexName, existingDim, requestedDim: dimension },
      });
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
    } else {
      const mastraError = new MastraError({
        id: 'VECTOR_VALIDATE_INDEX_NO_DIMENSION',
        text: `Index "${indexName}" already exists, but could not retrieve its dimensions for validation.`,
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.SYSTEM,
        details: { indexName },
      });
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
    }
  }
}

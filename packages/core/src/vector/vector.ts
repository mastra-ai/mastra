import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { EmbeddingModel as EmbeddingModelV1 } from 'ai';
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
  DescribeIndexParams,
  DeleteIndexParams,
} from './types';

export type MastraEmbeddingModel<T> = EmbeddingModelV1<T> | EmbeddingModelV2<T>;
export abstract class MastraVector<Filter = VectorFilter> extends MastraBase {
  constructor() {
    super({ name: 'MastraVector', component: 'VECTOR' });
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

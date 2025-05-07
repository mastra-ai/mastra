import { MastraBase } from '../base';
import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  CreateIndexArgs,
  UpsertVectorArgs,
  QueryVectorArgs,
} from './types';

export abstract class MastraVector extends MastraBase {
  constructor() {
    super({ name: 'MastraVector', component: 'VECTOR' });
  }

  get indexSeparator(): string {
    return '_';
  }

  private readonly baseKeys = {
    query: ['queryVector', 'topK', 'filter', 'includeVector'],
    upsert: ['vectors', 'metadata', 'ids'],
    createIndex: ['dimension', 'metric'],
  } as const;

  protected normalizeArgs<T, E extends any[] = never>(
    method: string,
    [first, ...rest]: ParamsToArgs<T> | E,
    extendedKeys: string[] = [],
  ): T {
    if (typeof first === 'object') {
      return first as T;
    }

    this.logger.warn(
      `Deprecation Warning: Passing individual arguments to ${method}() is deprecated.
      Please use an object parameter instead.
      Individual arguments will be removed on May 20th.`,
    );

    const baseKeys = this.baseKeys[method as keyof typeof this.baseKeys] || [];
    const paramKeys = [...baseKeys, ...extendedKeys].slice(0, rest.length);

    return {
      indexName: first as string,
      ...Object.fromEntries(paramKeys.map((key, i) => [key, rest[i]])),
    } as T;
  }
  // Adds type checks for positional arguments if used
  abstract query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]>;
  // Adds type checks for positional arguments if used
  abstract upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]>;
  // Adds type checks for positional arguments if used
  abstract createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;

  async updateIndexById(
    _indexName: string,
    _id: string,
    _update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    throw new Error('updateIndexById is not implemented yet');
  }
  async deleteIndexById(_indexName: string, _id: string): Promise<void> {
    throw new Error('deleteById is not implemented yet');
  }

  protected async validateExistingIndex(indexName: string, dimension: number, metric: string) {
    let info: IndexStats;
    try {
      info = await this.describeIndex(indexName);
    } catch (infoError) {
      const message = `Index "${indexName}" already exists, but failed to fetch index info for dimension check: ${infoError}`;
      this.logger?.error(message);
      throw new Error(message);
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
      const message = `Index "${indexName}" already exists with ${existingDim} dimensions, but ${dimension} dimensions were requested`;
      this.logger?.error(message);
      throw new Error(message);
    } else {
      const message = `Index "${indexName}" already exists, but could not retrieve its dimensions for validation.`;
      this.logger?.error(message);
      throw new Error(message);
    }
  }
}

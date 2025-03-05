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
      `Deprecation Warning: Passing individual arguments to ${method}() is deprecated. ` +
        'Please use an object parameter instead.',
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
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    throw new Error('updateIndexById is not implemented yet');
  }
  async deleteIndexById(indexName: string, id: string): Promise<void> {
    throw new Error('deleteById is not implemented yet');
  }
}

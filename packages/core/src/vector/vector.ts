import { MastraBase } from '../base';
import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
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

  protected normalizeArgs<T>(method: string, [first, ...rest]: ParamsToArgs<T>, extendedKeys: string[] = []): T {
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
  abstract query(...args: ParamsToArgs<QueryVectorParams>): Promise<QueryResult[]>;

  abstract upsert(...args: ParamsToArgs<UpsertVectorParams>): Promise<string[]>;

  abstract createIndex(...args: ParamsToArgs<CreateIndexParams>): Promise<void>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;
}

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

  protected normalizeArgs<T extends { indexName: string }>(method: string, args: ParamsToArgs<T>): T {
    const [first, ...rest] = args;

    if (typeof first === 'object') {
      return first as T;
    }

    console.warn(
      `Deprecation Warning: Passing individual arguments to ${method}() is deprecated. ` +
        'Please use an object parameter instead.',
    );

    const paramKeys = Object.keys({} as T).filter(k => k !== 'indexName');

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

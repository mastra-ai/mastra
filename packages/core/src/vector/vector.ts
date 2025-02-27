import { MastraBase } from '../base';
import { PARAM_KEYS } from './types';
import type { IndexStats, ParamArgs, ParamTypes, QueryResult } from './types';
export abstract class MastraVector extends MastraBase {
  constructor() {
    super({ name: 'MastraVector', component: 'VECTOR' });
  }

  private getParamTemplate(method: keyof ParamArgs): Record<string, undefined> {
    const templates = {
      query: {
        indexName: undefined,
        queryVector: undefined,
        topK: undefined,
        filter: undefined,
        includeVector: undefined,
        documentFilter: undefined,
      },
      upsert: { indexName: undefined, vectors: undefined, metadata: undefined, ids: undefined, documents: undefined },
      createIndex: { indexName: undefined, dimension: undefined, metric: undefined },
    };
    return templates[method];
  }

  protected normalizeArgs<K extends keyof ParamArgs, T extends ParamTypes[K]>(
    method: K,
    args: ParamArgs[K],
    extendParams?: Partial<Omit<T, keyof ParamTypes[K]>>,
  ): T {
    const [first, ...rest] = args;

    if (typeof first === 'object') {
      return first as T;
    }

    console.warn(
      `Deprecation Warning: Passing individual arguments to ${method}() is deprecated. ` +
        'Please use an object parameter instead.',
    );

    const paramKeys = PARAM_KEYS[method].filter(k => k !== 'indexName');

    // Create params object from args
    const params = Object.fromEntries(paramKeys.map((key, i) => [key, rest[i]]));

    return {
      indexName: first as string,
      ...params,
      ...extendParams,
    } as T;
  }
  abstract query(...args: ParamArgs['query']): Promise<QueryResult[]>;

  abstract upsert(...args: ParamArgs['upsert']): Promise<string[]>;

  abstract createIndex(...args: ParamArgs['createIndex']): Promise<void>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;
}

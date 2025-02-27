import { MastraBase } from '../base';
import type { CreateIndexParams, IndexStats, QueryResult, QueryVectorParams, UpsertVectorParams } from './types';

export abstract class MastraVector extends MastraBase {
  constructor() {
    super({ name: 'MastraVector', component: 'VECTOR' });
  }

  abstract upsert(params: UpsertVectorParams): Promise<string[]>;

  abstract createIndex(params: CreateIndexParams): Promise<void>;

  abstract query(params: QueryVectorParams): Promise<QueryResult[]>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;
}

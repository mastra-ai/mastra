import { MastraBase } from '../base';

export { localEmbedder } from './fastembed';

export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  vector?: number[];
}

export interface IndexStats {
  dimension: number;
  count: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export abstract class MastraVector extends MastraBase {
  constructor() {
    super({ name: 'MastraVector', component: 'VECTOR' });
  }

  abstract upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[],
  ): Promise<string[]>;

  abstract createIndex(
    indexName: string,
    dimension: number,
    metric?: 'cosine' | 'euclidean' | 'dotproduct',
  ): Promise<void>;

  abstract query(
    indexName: string,
    queryVector: number[],
    topK?: number,
    filter?: Record<string, any>,
    includeVector?: boolean,
  ): Promise<QueryResult[]>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;
}

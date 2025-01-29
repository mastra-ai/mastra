import { MastraBase } from '../base';
import { embed } from '../embeddings';
import { EmbeddingOptions } from '../embeddings/types';
import { EmbedManyResult, EmbedResult } from '../llm/types';

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

  /**
   * Embeds text using the specified embedding model and options. Always returns embeddings as an array for simplicity
   */
  async embed(text: string | string[], options: EmbeddingOptions): Promise<{ embeddings: number[][] }> {
    const result = await embed(text, options);
    if (typeof text === `string`) {
      return {
        ...result,
        embeddings: [(result as EmbedResult<string>).embedding],
      };
    }

    return {
      ...result,
      embeddings: (result as EmbedManyResult<string>).embeddings,
    };
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

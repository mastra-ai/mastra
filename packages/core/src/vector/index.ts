import { Telemetry } from '../telemetry';

export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface IndexStats {
  dimension: number;
  count: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export abstract class MastraVector {
  #telemetry?: Telemetry;

  /**
   * Set the telemetry for the vector provider
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.#telemetry = telemetry;
    console.log(`Telemetry updated for Vector ${this.#telemetry.name}`);
  }

  abstract upsert(
    indexName: string,
    vectors: number[][],
    metadata?: Record<string, any>[],
    ids?: string[]
  ): Promise<string[]>;

  abstract createIndex(
    indexName: string,
    dimension: number,
    metric?: 'cosine' | 'euclidean' | 'dotproduct'
  ): Promise<void>;

  abstract query(
    indexName: string,
    queryVector: number[],
    topK?: number,
    filter?: Record<string, any>
  ): Promise<QueryResult[]>;

  abstract listIndexes(): Promise<string[]>;

  abstract describeIndex(indexName: string): Promise<IndexStats>;

  abstract deleteIndex(indexName: string): Promise<void>;
}

import type { UpsertVectorParams, QueryVectorParams } from '@mastra/core/vector';
import type { FusionAlgorithm, QueryMode } from '@upstash/vector';
import type { UpstashVectorFilter } from './filter';

export interface UpstashSparseVector {
  indices: number[];
  values: number[];
}

export interface UpstashUpsertVectorParams extends UpsertVectorParams {
  sparseVectors?: UpstashSparseVector[];
}

export interface UpstashQueryVectorParams extends QueryVectorParams<UpstashVectorFilter> {
  sparseVector?: UpstashSparseVector;
  fusionAlgorithm?: FusionAlgorithm;
  queryMode?: QueryMode;
}

export type UpstashUpdateVectorParams =
  | {
      indexName: string;
      id: string;
      filter?: never;
      update: {
        vector?: number[];
        metadata?: Record<string, any>;
        sparseVector?: UpstashSparseVector;
      };
    }
  | {
      indexName: string;
      id?: never;
      filter: UpstashVectorFilter;
      update: {
        vector?: number[];
        metadata?: Record<string, any>;
        sparseVector?: UpstashSparseVector;
      };
    };

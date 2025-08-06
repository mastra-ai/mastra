import type { UpsertVectorParams, QueryVectorParams, UpdateVectorParams } from '@mastra/core/vector';
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

export interface UpstashUpdateVectorParams extends UpdateVectorParams {
  update: {
    vector?: number[];
    metadata?: Record<string, any>;
    sparseVector?: UpstashSparseVector;
  };
}

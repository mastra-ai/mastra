import type { EmbeddingModel } from 'ai';
import type { RerankConfig } from '../rerank';

export type VectorQueryToolOptions =
  | {
      id?: string;
      description?: string;
      useRuntimeContext: true;
      model: EmbeddingModel<string>;
    }
  | {
      id?: string;
      description?: string;
      useRuntimeContext?: false; // default is false if not provided
      indexName: string;
      vectorStoreName: string;
      model: EmbeddingModel<string>;
      enableFilter?: boolean;
      includeVectors?: boolean;
      includeSources?: boolean;
      reranker?: RerankConfig;
    };

export type GraphRagToolOptions =
  | {
      id?: string;
      description?: string;
      useRuntimeContext: true;
      model: EmbeddingModel<string>;
      graphOptions?: {
        dimension?: number;
        randomWalkSteps?: number;
        restartProb?: number;
        threshold?: number;
      };
    }
  | {
      id?: string;
      description?: string;
      useRuntimeContext?: false; // default is false if not provided
      indexName: string;
      vectorStoreName: string;
      model: EmbeddingModel<string>;
      enableFilter?: boolean;
      includeSources?: boolean;
      graphOptions?: {
        dimension?: number;
        randomWalkSteps?: number;
        restartProb?: number;
        threshold?: number;
      };
    };

export const defaultGraphOptions = {
  dimension: 1536,
  randomWalkSteps: 100,
  restartProb: 0.15,
  threshold: 0.7,
};

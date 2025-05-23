import type { EmbeddingModel } from 'ai';
import type { RerankConfig } from '../rerank';

export type VectorQueryToolOptions =
  | {
      useRuntimeContext: true;
      model: EmbeddingModel<string>;
      id?: string;
      description?: string;
    }
  | {
      useRuntimeContext?: false; // default is false if not provided
      model: EmbeddingModel<string>;
      enableFilter?: boolean;
      includeVectors?: boolean;
      includeSources?: boolean;
      reranker?: RerankConfig;
      id?: string;
      description?: string;
      vectorStoreName: string;
      indexName: string;
    };

export type GraphRagToolOptions =
  | {
      useRuntimeContext: true;
      model: EmbeddingModel<string>;
      id?: string;
      description?: string;
      graphOptions?: {
        dimension?: number;
        randomWalkSteps?: number;
        restartProb?: number;
        threshold?: number;
      };
    }
  | {
      useRuntimeContext?: false; // default is false if not provided
      vectorStoreName: string;
      indexName: string;
      model: EmbeddingModel<string>;
      enableFilter?: boolean;
      includeSources?: boolean;
      graphOptions?: {
        dimension?: number;
        randomWalkSteps?: number;
        restartProb?: number;
        threshold?: number;
      };
      id?: string;
      description?: string;
    };

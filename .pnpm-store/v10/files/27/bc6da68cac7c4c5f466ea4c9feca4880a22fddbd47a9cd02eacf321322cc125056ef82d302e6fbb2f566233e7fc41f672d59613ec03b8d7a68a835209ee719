import type { MastraVector, MastraEmbeddingModel } from '@mastra/core/vector';
import type { RerankConfig } from '../rerank/index.js';
export interface PineconeConfig {
    namespace?: string;
    sparseVector?: {
        indices: number[];
        values: number[];
    };
}
export interface PgVectorConfig {
    minScore?: number;
    ef?: number;
    probes?: number;
}
type LiteralValue = string | number | boolean;
type ListLiteralValue = LiteralValue[];
type LiteralNumber = number;
type LogicalOperator = '$and' | '$or';
type InclusionOperator = '$in' | '$nin';
type WhereOperator = '$gt' | '$gte' | '$lt' | '$lte' | '$ne' | '$eq';
type OperatorExpression = {
    [key in WhereOperator | InclusionOperator | LogicalOperator]?: LiteralValue | ListLiteralValue;
};
type BaseWhere = {
    [key: string]: LiteralValue | OperatorExpression;
};
type LogicalWhere = {
    [key in LogicalOperator]?: Where[];
};
type Where = BaseWhere | LogicalWhere;
type WhereDocumentOperator = '$contains' | '$not_contains' | LogicalOperator;
type WhereDocument = {
    [key in WhereDocumentOperator]?: LiteralValue | LiteralNumber | WhereDocument[];
};
export interface ChromaConfig {
    where?: Where;
    whereDocument?: WhereDocument;
}
export type DatabaseConfig = {
    pinecone?: PineconeConfig;
    pgvector?: PgVectorConfig;
    chroma?: ChromaConfig;
    [key: string]: any;
};
export type VectorQueryToolOptions = {
    id?: string;
    description?: string;
    indexName: string;
    model: MastraEmbeddingModel<string>;
    enableFilter?: boolean;
    includeVectors?: boolean;
    includeSources?: boolean;
    reranker?: RerankConfig;
    /** Database-specific configuration options */
    databaseConfig?: DatabaseConfig;
} & ProviderOptions & ({
    vectorStoreName: string;
} | {
    vectorStoreName?: string;
    vectorStore: MastraVector;
});
export type GraphRagToolOptions = {
    id?: string;
    description?: string;
    indexName: string;
    vectorStoreName: string;
    model: MastraEmbeddingModel<string>;
    enableFilter?: boolean;
    includeSources?: boolean;
    graphOptions?: {
        dimension?: number;
        randomWalkSteps?: number;
        restartProb?: number;
        threshold?: number;
    };
} & ProviderOptions;
export type ProviderOptions = {
    /**
     * Provider-specific options for the embedding model (e.g., outputDimensionality).
     *
     * ⚠️  **IMPORTANT**: `providerOptions` only work with AI SDK v2 models.
     *
     * **For v1 models**: Configure options when creating the model:
     * ✅ const model = openai.embedding('text-embedding-3-small', { dimensions: 512 });
     *
     * **For v2 models**: Use providerOptions:
     * ✅ providerOptions: { openai: { dimensions: 512 } }
     */
    providerOptions?: Record<string, Record<string, any>>;
};
/**
 * Default options for GraphRAG
 * @default
 * ```json
 * {
 *   "dimension": 1536,
 *   "randomWalkSteps": 100,
 *   "restartProb": 0.15,
 *   "threshold": 0.7
 * }
 * ```
 */
export declare const defaultGraphOptions: {
    dimension: number;
    randomWalkSteps: number;
    restartProb: number;
    threshold: number;
};
export {};
//# sourceMappingURL=types.d.ts.map
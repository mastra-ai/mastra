import type { MastraVector, MastraEmbeddingModel, QueryResult } from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import type { DatabaseConfig, ProviderOptions } from '../tools/types.js';
type VectorQuerySearchParams = {
    indexName: string;
    vectorStore: MastraVector;
    queryText: string;
    model: MastraEmbeddingModel<string>;
    queryFilter?: VectorFilter;
    topK: number;
    includeVectors?: boolean;
    maxRetries?: number;
    /** Database-specific configuration options */
    databaseConfig?: DatabaseConfig;
} & ProviderOptions;
interface VectorQuerySearchResult {
    results: QueryResult[];
    queryEmbedding: number[];
}
export declare const vectorQuerySearch: ({ indexName, vectorStore, queryText, model, queryFilter, topK, includeVectors, maxRetries, databaseConfig, providerOptions, }: VectorQuerySearchParams) => Promise<VectorQuerySearchResult>;
export {};
//# sourceMappingURL=vector-search.d.ts.map
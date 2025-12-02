import type { MastraLanguageModel } from '@mastra/core/agent';
import type { RelevanceScoreProvider } from '@mastra/core/relevance';
import type { QueryResult } from '@mastra/core/vector';
type WeightConfig = {
    semantic?: number;
    vector?: number;
    position?: number;
};
interface ScoringDetails {
    semantic: number;
    vector: number;
    position: number;
    queryAnalysis?: {
        magnitude: number;
        dominantFeatures: number[];
    };
}
export interface RerankResult {
    result: QueryResult;
    score: number;
    details: ScoringDetails;
}
export interface RerankerOptions {
    weights?: WeightConfig;
    topK?: number;
}
export interface RerankerFunctionOptions {
    weights?: WeightConfig;
    queryEmbedding?: number[];
    topK?: number;
}
export interface RerankConfig {
    options?: RerankerOptions;
    model: MastraLanguageModel | RelevanceScoreProvider;
}
export declare function rerankWithScorer({ results, query, scorer, options, }: {
    results: QueryResult[];
    query: string;
    scorer: RelevanceScoreProvider;
    options: RerankerFunctionOptions;
}): Promise<RerankResult[]>;
export declare function rerank(results: QueryResult[], query: string, model: MastraLanguageModel, options: RerankerFunctionOptions): Promise<RerankResult[]>;
export {};
//# sourceMappingURL=index.d.ts.map
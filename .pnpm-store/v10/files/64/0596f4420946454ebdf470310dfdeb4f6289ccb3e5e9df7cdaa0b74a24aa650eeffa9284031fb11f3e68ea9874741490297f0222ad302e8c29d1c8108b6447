import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { OpenAICompatibleConfig } from './shared.types.js';
/**
 * Information about a known embedding model
 */
export interface EmbeddingModelInfo {
    id: string;
    provider: string;
    dimensions: number;
    maxInputTokens: number;
    description?: string;
}
/**
 * Hardcoded list of known embedding models
 * This is a curated list that provides autocomplete support
 */
export declare const EMBEDDING_MODELS: EmbeddingModelInfo[];
/**
 * Type for embedding model IDs in the format "provider/model"
 */
export type EmbeddingModelId = 'openai/text-embedding-3-small' | 'openai/text-embedding-3-large' | 'openai/text-embedding-ada-002' | 'google/gemini-embedding-001' | 'google/text-embedding-004';
/**
 * Check if a model ID is a known embedding model
 */
export declare function isKnownEmbeddingModel(modelId: string): boolean;
/**
 * Get information about a known embedding model
 */
export declare function getEmbeddingModelInfo(modelId: string): EmbeddingModelInfo | undefined;
/**
 * Model router for embedding models that uses the provider/model string format.
 * Automatically resolves the correct AI SDK provider and initializes the embedding model.
 *
 * @example
 * ```ts
 * const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
 * const result = await embedder.doEmbed({ values: ['hello world'] });
 * ```
 */
export declare class ModelRouterEmbeddingModel<VALUE extends string = string> implements EmbeddingModelV2<VALUE> {
    readonly specificationVersion: "v2";
    readonly modelId: string;
    readonly provider: string;
    maxEmbeddingsPerCall: number | PromiseLike<number | undefined>;
    supportsParallelCalls: boolean | PromiseLike<boolean>;
    private providerModel;
    constructor(config: string | OpenAICompatibleConfig);
    doEmbed(args: Parameters<EmbeddingModelV2<VALUE>['doEmbed']>[0]): Promise<Awaited<ReturnType<EmbeddingModelV2<VALUE>['doEmbed']>>>;
}
//# sourceMappingURL=embedding-router.d.ts.map
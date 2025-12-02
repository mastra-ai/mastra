export { convertArrayToReadableStream, mockId } from '@ai-sdk/provider-utils/test';
import { EmbeddingModelV1, LanguageModelV1 } from '@ai-sdk/provider';

declare class MockEmbeddingModelV1<VALUE> implements EmbeddingModelV1<VALUE> {
    readonly specificationVersion = "v1";
    readonly provider: EmbeddingModelV1<VALUE>['provider'];
    readonly modelId: EmbeddingModelV1<VALUE>['modelId'];
    readonly maxEmbeddingsPerCall: EmbeddingModelV1<VALUE>['maxEmbeddingsPerCall'];
    readonly supportsParallelCalls: EmbeddingModelV1<VALUE>['supportsParallelCalls'];
    doEmbed: EmbeddingModelV1<VALUE>['doEmbed'];
    constructor({ provider, modelId, maxEmbeddingsPerCall, supportsParallelCalls, doEmbed, }?: {
        provider?: EmbeddingModelV1<VALUE>['provider'];
        modelId?: EmbeddingModelV1<VALUE>['modelId'];
        maxEmbeddingsPerCall?: EmbeddingModelV1<VALUE>['maxEmbeddingsPerCall'] | null;
        supportsParallelCalls?: EmbeddingModelV1<VALUE>['supportsParallelCalls'];
        doEmbed?: EmbeddingModelV1<VALUE>['doEmbed'];
    });
}

declare class MockLanguageModelV1 implements LanguageModelV1 {
    readonly specificationVersion = "v1";
    readonly provider: LanguageModelV1['provider'];
    readonly modelId: LanguageModelV1['modelId'];
    supportsUrl: LanguageModelV1['supportsUrl'];
    doGenerate: LanguageModelV1['doGenerate'];
    doStream: LanguageModelV1['doStream'];
    readonly defaultObjectGenerationMode: LanguageModelV1['defaultObjectGenerationMode'];
    readonly supportsStructuredOutputs: LanguageModelV1['supportsStructuredOutputs'];
    constructor({ provider, modelId, supportsUrl, doGenerate, doStream, defaultObjectGenerationMode, supportsStructuredOutputs, }?: {
        provider?: LanguageModelV1['provider'];
        modelId?: LanguageModelV1['modelId'];
        supportsUrl?: LanguageModelV1['supportsUrl'];
        doGenerate?: LanguageModelV1['doGenerate'];
        doStream?: LanguageModelV1['doStream'];
        defaultObjectGenerationMode?: LanguageModelV1['defaultObjectGenerationMode'];
        supportsStructuredOutputs?: LanguageModelV1['supportsStructuredOutputs'];
    });
}

declare function mockValues<T>(...values: T[]): () => T;

/**
 * Creates a ReadableStream that emits the provided values with an optional delay between each value.
 *
 * @param options - The configuration options
 * @param options.chunks - Array of values to be emitted by the stream
 * @param options.initialDelayInMs - Optional initial delay in milliseconds before emitting the first value (default: 0). Can be set to `null` to skip the initial delay. The difference between `initialDelayInMs: null` and `initialDelayInMs: 0` is that `initialDelayInMs: null` will emit the values without any delay, while `initialDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @param options.chunkDelayInMs - Optional delay in milliseconds between emitting each value (default: 0). Can be set to `null` to skip the delay. The difference between `chunkDelayInMs: null` and `chunkDelayInMs: 0` is that `chunkDelayInMs: null` will emit the values without any delay, while `chunkDelayInMs: 0` will emit the values with a delay of 0 milliseconds.
 * @returns A ReadableStream that emits the provided values
 */
declare function simulateReadableStream$1<T>({ chunks, initialDelayInMs, chunkDelayInMs, _internal, }: {
    chunks: T[];
    initialDelayInMs?: number | null;
    chunkDelayInMs?: number | null;
    _internal?: {
        delay?: (ms: number | null) => Promise<void>;
    };
}): ReadableStream<T>;

/**
 * @deprecated Use `simulateReadableStream` from `ai` instead.
 */
declare const simulateReadableStream: typeof simulateReadableStream$1;

export { MockEmbeddingModelV1, MockLanguageModelV1, mockValues, simulateReadableStream };

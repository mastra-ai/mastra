import type { LanguageModelV2FinishReason, LanguageModelV2StreamPart, LanguageModelV2Usage, SharedV2ProviderMetadata } from '@ai-sdk/provider-v5';
import type { ModelMessage, ObjectStreamPart, TextStreamPart, ToolSet } from 'ai-v5';
import type { AIV5ResponseMessage } from '../../../agent/message-list/index.js';
import type { OutputSchema, PartialSchemaOutput } from '../../base/schema.js';
import type { ChunkType } from '../../types.js';
export type StreamPart = Exclude<LanguageModelV2StreamPart, {
    type: 'finish';
}> | {
    type: 'finish';
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata: SharedV2ProviderMetadata;
    messages: {
        all: ModelMessage[];
        user: ModelMessage[];
        nonUser: AIV5ResponseMessage[];
    };
};
export declare function convertFullStreamChunkToMastra(value: StreamPart, ctx: {
    runId: string;
}): ChunkType | undefined;
export type OutputChunkType<OUTPUT extends OutputSchema = undefined> = TextStreamPart<ToolSet> | ObjectStreamPart<PartialSchemaOutput<OUTPUT>> | undefined;
export declare function convertMastraChunkToAISDKv5<OUTPUT extends OutputSchema = undefined>({ chunk, mode, }: {
    chunk: ChunkType<OUTPUT>;
    mode?: 'generate' | 'stream';
}): OutputChunkType<OUTPUT>;
//# sourceMappingURL=transform.d.ts.map
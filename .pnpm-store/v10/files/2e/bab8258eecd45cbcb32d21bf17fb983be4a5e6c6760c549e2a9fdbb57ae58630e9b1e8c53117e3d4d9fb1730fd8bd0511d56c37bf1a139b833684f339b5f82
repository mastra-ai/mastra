import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { ModelManagerModelConfig } from '../../stream/types.js';
import { MessageList } from '../../agent/message-list/index.js';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock.js';
export declare const mockDate: Date;
export declare const defaultSettings: () => {
    readonly prompt: "prompt";
    readonly experimental_generateMessageId: () => string;
    readonly _internal: {
        readonly generateId: () => string;
        readonly currentDate: () => Date;
    };
    readonly agentId: "agent-id";
    readonly onError: () => void;
};
export declare const testUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens: undefined;
    cachedInputTokens: undefined;
};
export declare const testUsage2: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens: number;
    cachedInputTokens: number;
};
export declare function createTestModels({ warnings, stream, request, response, }?: {
    stream?: ReadableStream<LanguageModelV2StreamPart>;
    request?: {
        body: string;
    };
    response?: {
        headers: Record<string, string>;
    };
    warnings?: LanguageModelV2CallWarning[];
}): ModelManagerModelConfig[];
export declare const modelWithSources: MockLanguageModelV2;
export declare const modelWithDocumentSources: MockLanguageModelV2;
export declare const modelWithFiles: MockLanguageModelV2;
export declare const modelWithReasoning: MockLanguageModelV2;
export declare const createMessageListWithUserMessage: () => MessageList;
//# sourceMappingURL=utils.d.ts.map
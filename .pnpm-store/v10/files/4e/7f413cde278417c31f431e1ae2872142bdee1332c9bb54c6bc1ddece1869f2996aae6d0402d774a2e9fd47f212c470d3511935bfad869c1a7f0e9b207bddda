import type { InferUIMessageChunk, TextStreamPart, ToolSet, UIMessage, IdGenerator } from 'ai-v5';
export declare function getResponseUIMessageId({ originalMessages, responseMessageId, }: {
    originalMessages: UIMessage[] | undefined;
    responseMessageId: string | IdGenerator | undefined;
}): string | undefined;
export declare function convertFullStreamChunkToUIMessageStream<UI_MESSAGE extends UIMessage>({ part, messageMetadataValue, sendReasoning, sendSources, onError, sendStart, sendFinish, responseMessageId, }: {
    part: TextStreamPart<ToolSet> | {
        type: 'tool-output';
        toolCallId: string;
        output: any;
    };
    messageMetadataValue?: unknown;
    sendReasoning?: boolean;
    sendSources?: boolean;
    onError: (error: unknown) => string;
    sendStart?: boolean;
    sendFinish?: boolean;
    responseMessageId?: string;
}): InferUIMessageChunk<UI_MESSAGE> | undefined;
//# sourceMappingURL=ui-message.d.ts.map
import { getErrorMessage } from "@ai-sdk/provider-v5";
import type { ReasoningUIPart, StepResult, ToolSet } from "ai-v5";
import { MessageList } from "../../../agent/message-list";
import type { MastraMessageV2 } from "../../../memory";
import { convertFullStreamChunkToAISDKv5 } from "./transform";

export class DefaultStepResult<TOOLS extends ToolSet> implements StepResult<TOOLS> {
    readonly content: StepResult<TOOLS>['content'];
    readonly finishReason: StepResult<TOOLS>['finishReason'];
    readonly usage: StepResult<TOOLS>['usage'];
    readonly warnings: StepResult<TOOLS>['warnings'];
    readonly request: StepResult<TOOLS>['request'];
    readonly response: StepResult<TOOLS>['response'];
    readonly providerMetadata: StepResult<TOOLS>['providerMetadata'];

    constructor({
        content,
        finishReason,
        usage,
        warnings,
        request,
        response,
        providerMetadata,
    }: {
        content: StepResult<TOOLS>['content'];
        finishReason: StepResult<TOOLS>['finishReason'];
        usage: StepResult<TOOLS>['usage'];
        warnings: StepResult<TOOLS>['warnings'];
        request: StepResult<TOOLS>['request'];
        response: StepResult<TOOLS>['response'];
        providerMetadata: StepResult<TOOLS>['providerMetadata'];
    }) {
        this.content = content;
        this.finishReason = finishReason;
        this.usage = usage;
        this.warnings = warnings;
        this.request = request;
        this.response = response;
        this.providerMetadata = providerMetadata;
    }

    get text() {
        return this.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('');
    }

    get reasoning() {
        return this.content.filter(part => part.type === 'reasoning');
    }

    get reasoningText() {
        return this.reasoning.length === 0 ? undefined : this.reasoning.map(part => part.text).join('');
    }

    get files() {
        return this.content.filter(part => part.type === 'file').map(part => part.file);
    }

    get sources() {
        return this.content.filter(part => part.type === 'source');
    }

    get toolCalls() {
        return this.content.filter(part => part.type === 'tool-call');
    }

    get staticToolCalls() {
        // @ts-ignore
        return this.toolCalls.filter((toolCall): toolCall is StaticToolCall<TOOLS> => toolCall.dynamic === false);
    }

    get dynamicToolCalls() {
        // @ts-ignore
        return this.toolCalls.filter((toolCall): toolCall is DynamicToolCall => toolCall.dynamic === true);
    }

    get toolResults() {
        return this.content.filter(part => part.type === 'tool-result');
    }

    get staticToolResults() {
        // @ts-ignore
        return this.toolResults.filter((toolResult): toolResult is StaticToolResult<TOOLS> => toolResult.dynamic === false);
    }

    get dynamicToolResults() {
        // @ts-ignore
        return this.toolResults.filter((toolResult): toolResult is DynamicToolResult => toolResult.dynamic === true);
    }
}

export function reasoningDetailsFromMessages(messages: MastraMessageV2[]): ReasoningUIPart[] {
    return messages
        .flatMap(msg => {
            // v3 messages have content.parts array
            if (msg.content?.parts && Array.isArray(msg.content.parts)) {
                return msg.content.parts;
            }
            return [];
        })
        .filter(part => part.type === `reasoning`)
        .flatMap(part => {
            return {
                type: 'reasoning',
                text: part.reasoning,
                details: part.details,
            }
        });
}

export function transformResponse({
    response,
    isMessages = false,
    runId,
}: {
    response: any,
    isMessages?: boolean,
    runId: string,
}) {
    const newResponse = { ...response };
    const messageList = new MessageList();
    messageList.add(response.messages, 'response');

    const formattedMessages = messageList.get.response.v2().filter((message: any) => message.role !== 'user');

    const hasTools = formattedMessages.some(
        (message: any) =>
            Array.isArray(message.content) && message.content.some((part: any) => part.type === 'tool-result'),
    );
    newResponse.messages = formattedMessages.map((message: any) => {
        // Handle string content
        if (typeof message.content === 'string') {
            return message;
        }

        let newContent = message.content.map((part: any) => {
            if (part.type === 'file') {
                if (isMessages) {
                    return {
                        type: 'file',
                        mediaType: part.mediaType,
                        data: part.data,
                        providerOptions: part.providerOptions,
                    };
                }
                const transformedFile = convertFullStreamChunkToAISDKv5({
                    chunk: {
                        runId,
                        type: 'file',
                        from: 'AGENT',
                        payload: {
                            data: part.data,
                            mimeType: part.mediaType,
                        },
                    },
                    getErrorMessage: getErrorMessage,
                });

                return transformedFile;
            }

            if (!isMessages) {
                const { providerOptions, providerMetadata, ...rest } = part;
                const providerMetadataValue = providerMetadata ?? providerOptions;
                return {
                    ...rest,
                    ...(providerMetadataValue ? { providerMetadata: providerMetadataValue } : {}),
                };
            }

            return part;
        });

        if (isMessages && !hasTools) {
            newContent = newContent.filter((part: any) => part.type !== 'source');
        }

        return {
            ...message,
            content: newContent,
        };
    });

    return newResponse;
}

export function transformSteps({
    steps,
    runId,
}: {
    steps: any[],
    runId: string,
}) {
    return steps.map(step => {
        return new DefaultStepResult({
            content: transformResponse(step.response).messages?.flatMap((message: any) => message.content) ?? [],
            warnings: step.warnings ?? [],
            providerMetadata: step.providerMetadata,
            finishReason: step.finishReason as StepResult<ToolSet>['finishReason'],
            response: transformResponse({ response: step.response, isMessages: true, runId }),
            request: step.request,
            usage: step.usage,
        });
    });
}
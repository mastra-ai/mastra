/**
 * Completions handlers - framework-agnostic
 * These handlers can be used by any server framework (Express, Hono, etc.)
 */

import type { MessageListInput } from '@mastra/core/agent/message-list';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { Context } from '../types';

export interface CompletionsHandlerParams extends Context {
    runtimeContext: RuntimeContext;
    body: {
        model: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
        thread?: string;
        resource?: string;
    };
    abortSignal?: AbortSignal;
}

export interface CompletionsResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            tool_calls?: Array<{
                id: string;
                type: 'function';
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
            refusal?: string | null;
        };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        completion_tokens_details?: {
            reasoning_tokens?: number;
            audio_tokens?: number;
            accepted_prediction_tokens?: number;
            rejected_prediction_tokens?: number;
        };
        prompt_tokens_details?: {
            cached_tokens?: number;
            audio_tokens?: number;
        };
    };
}

/**
 * Non-streaming completions handler
 */
export async function completionsHandler({
    mastra,
    runtimeContext,
    body,
    abortSignal,
}: CompletionsHandlerParams): Promise<CompletionsResponse> {
    const agent = mastra.getAgent(body.model.replace('mastra/', ''));

    const messagesWithoutSystem = body.messages.filter(message => message.role !== 'system');

    const response = await agent.generate(messagesWithoutSystem as MessageListInput, {
        modelSettings: {
            temperature: body.temperature,
            maxOutputTokens: body.max_tokens,
        },
        memory: {
            thread: { id: body.thread || 'test' },
            resource: body.resource || 'test',
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
        abortSignal,
    });

    // Convert Mastra tool calls to OpenAI format
    const toolCalls = response.toolCalls?.map((toolCall, index) => ({
        id: toolCall.payload.toolCallId || `call_${Date.now()}_${index}`,
        type: 'function' as const,
        function: {
            name: toolCall.payload.toolName,
            arguments: JSON.stringify(toolCall.payload.args || {}),
        },
    }));

    // Build usage details
    const usage = response.usage ? {
        prompt_tokens: response.usage.inputTokens || 0,
        completion_tokens: response.usage.outputTokens || 0,
        total_tokens: response.usage.totalTokens || 0,
        ...(response.usage.reasoningTokens || response.usage.cachedInputTokens ? {
            completion_tokens_details: {
                ...(response.usage.reasoningTokens ? { reasoning_tokens: response.usage.reasoningTokens } : {}),
            },
            prompt_tokens_details: {
                ...(response.usage.cachedInputTokens ? { cached_tokens: response.usage.cachedInputTokens } : {}),
            },
        } : {}),
    } : undefined;

    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.text || '',
                    ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
                },
                finish_reason: response.finishReason || null,
            },
        ],
        ...(usage ? { usage } : {}),
    };
}

/**
 * Streaming completions handler
 */
export async function streamCompletionsHandler({
    mastra: _mastra,
    runtimeContext: _runtimeContext,
    body: _body,
    abortSignal: _abortSignal,
}: CompletionsHandlerParams): Promise<ReadableStream> {
    // TODO: Implement streaming with agent
    throw new Error('Streaming not yet implemented');
}

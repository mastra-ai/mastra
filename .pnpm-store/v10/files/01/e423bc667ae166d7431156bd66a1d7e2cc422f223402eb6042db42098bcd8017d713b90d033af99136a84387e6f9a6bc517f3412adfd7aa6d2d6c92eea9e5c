import { OpenRouterCore } from "../core.js";
import { RequestOptions } from "./sdks.js";
import * as models from "../models/index.js";
import { EnhancedTool, ParsedToolCall, MaxToolRounds, EnhancedResponseStreamEvent, ToolStreamEvent, ChatStreamEvent } from "./tool-types.js";
export interface GetResponseOptions {
    request: models.OpenResponsesRequest;
    client: OpenRouterCore;
    options?: RequestOptions;
    tools?: EnhancedTool[];
    maxToolRounds?: MaxToolRounds;
}
/**
 * A wrapper around a streaming response that provides multiple consumption patterns.
 *
 * Allows consuming the response in multiple ways:
 * - `await response.getMessage()` - Get the completed message
 * - `await response.getText()` - Get just the text
 * - `for await (const delta of response.getTextStream())` - Stream text deltas
 * - `for await (const msg of response.getNewMessagesStream())` - Stream incremental message updates
 * - `for await (const event of response.getFullResponsesStream())` - Stream all response events
 *
 * All consumption patterns can be used concurrently thanks to the underlying
 * ReusableReadableStream implementation.
 */
export declare class ResponseWrapper {
    private reusableStream;
    private streamPromise;
    private messagePromise;
    private textPromise;
    private options;
    private initPromise;
    private toolExecutionPromise;
    private finalResponse;
    private preliminaryResults;
    private allToolExecutionRounds;
    constructor(options: GetResponseOptions);
    /**
     * Initialize the stream if not already started
     * This is idempotent - multiple calls will return the same promise
     */
    private initStream;
    /**
     * Execute tools automatically if they are provided and have execute functions
     * This is idempotent - multiple calls will return the same promise
     */
    private executeToolsIfNeeded;
    /**
     * Get the completed message from the response.
     * This will consume the stream until completion, execute any tools, and extract the first message.
     * Returns an AssistantMessage in chat format.
     */
    getMessage(): Promise<models.AssistantMessage>;
    /**
     * Get just the text content from the response.
     * This will consume the stream until completion, execute any tools, and extract the text.
     */
    getText(): Promise<string>;
    /**
     * Get the complete response object including usage information.
     * This will consume the stream until completion and execute any tools.
     * Returns the full OpenResponsesNonStreamingResponse with usage data (inputTokens, outputTokens, cachedTokens, etc.)
     */
    getResponse(): Promise<models.OpenResponsesNonStreamingResponse>;
    /**
     * Stream all response events as they arrive.
     * Multiple consumers can iterate over this stream concurrently.
     * Includes preliminary tool result events after tool execution.
     */
    getFullResponsesStream(): AsyncIterableIterator<EnhancedResponseStreamEvent>;
    /**
     * Stream only text deltas as they arrive.
     * This filters the full event stream to only yield text content.
     */
    getTextStream(): AsyncIterableIterator<string>;
    /**
     * Stream incremental message updates as content is added.
     * Each iteration yields an updated version of the message with new content.
     * Also yields ToolResponseMessages after tool execution completes.
     * Returns AssistantMessage or ToolResponseMessage in chat format.
     */
    getNewMessagesStream(): AsyncIterableIterator<models.AssistantMessage | models.ToolResponseMessage>;
    /**
     * Stream only reasoning deltas as they arrive.
     * This filters the full event stream to only yield reasoning content.
     */
    getReasoningStream(): AsyncIterableIterator<string>;
    /**
     * Stream tool call argument deltas and preliminary results.
     * This filters the full event stream to yield:
     * - Tool call argument deltas as { type: "delta", content: string }
     * - Preliminary results as { type: "preliminary_result", toolCallId, result }
     */
    getToolStream(): AsyncIterableIterator<ToolStreamEvent>;
    /**
     * Stream events in chat format (compatibility layer).
     * Note: This transforms responses API events into a chat-like format.
     * Includes preliminary tool result events after tool execution.
     *
     * @remarks
     * This is a compatibility method that attempts to transform the responses API
     * stream into a format similar to the chat API. Due to differences in the APIs,
     * this may not be a perfect mapping.
     */
    getFullChatStream(): AsyncIterableIterator<ChatStreamEvent>;
    /**
     * Get all tool calls from the completed response (before auto-execution).
     * Note: If tools have execute functions, they will be automatically executed
     * and this will return the tool calls from the initial response.
     * Returns structured tool calls with parsed arguments.
     */
    getToolCalls(): Promise<ParsedToolCall[]>;
    /**
     * Stream structured tool call objects as they're completed.
     * Each iteration yields a complete tool call with parsed arguments.
     */
    getToolCallsStream(): AsyncIterableIterator<ParsedToolCall>;
    /**
     * Cancel the underlying stream and all consumers
     */
    cancel(): Promise<void>;
}
//# sourceMappingURL=response-wrapper.d.ts.map
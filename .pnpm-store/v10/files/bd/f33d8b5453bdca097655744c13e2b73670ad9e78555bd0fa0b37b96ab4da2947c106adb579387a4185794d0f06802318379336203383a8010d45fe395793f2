import * as models from "../models/index.js";
import { ReusableReadableStream } from "./reusable-stream.js";
import { ParsedToolCall } from "./tool-types.js";
/**
 * Extract text deltas from responses stream events
 */
export declare function extractTextDeltas(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): AsyncIterableIterator<string>;
/**
 * Extract reasoning deltas from responses stream events
 */
export declare function extractReasoningDeltas(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): AsyncIterableIterator<string>;
/**
 * Extract tool call argument deltas from responses stream events
 */
export declare function extractToolDeltas(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): AsyncIterableIterator<string>;
/**
 * Build incremental message updates from responses stream events
 * Returns AssistantMessage (chat format) instead of ResponsesOutputMessage
 */
export declare function buildMessageStream(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): AsyncIterableIterator<models.AssistantMessage>;
/**
 * Consume stream until completion and return the complete response
 */
export declare function consumeStreamForCompletion(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): Promise<models.OpenResponsesNonStreamingResponse>;
/**
 * Extract the first message from a completed response
 */
export declare function extractMessageFromResponse(response: models.OpenResponsesNonStreamingResponse): models.AssistantMessage;
/**
 * Extract text from a response, either from outputText or by concatenating message content
 */
export declare function extractTextFromResponse(response: models.OpenResponsesNonStreamingResponse): string;
/**
 * Extract all tool calls from a completed response
 * Returns parsed tool calls with arguments as objects (not JSON strings)
 */
export declare function extractToolCallsFromResponse(response: models.OpenResponsesNonStreamingResponse): ParsedToolCall[];
/**
 * Build incremental tool call updates from responses stream events
 * Yields structured tool call objects as they're built from deltas
 */
export declare function buildToolCallStream(stream: ReusableReadableStream<models.OpenResponsesStreamEvent>): AsyncIterableIterator<ParsedToolCall>;
/**
 * Check if a response contains any tool calls
 */
export declare function responseHasToolCalls(response: models.OpenResponsesNonStreamingResponse): boolean;
//# sourceMappingURL=stream-transformers.d.ts.map
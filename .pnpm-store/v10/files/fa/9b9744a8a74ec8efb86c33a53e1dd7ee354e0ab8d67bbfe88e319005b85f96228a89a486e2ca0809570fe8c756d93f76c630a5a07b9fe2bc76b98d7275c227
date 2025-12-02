import { OpenRouterCore } from "../core.js";
import { RequestOptions } from "../lib/sdks.js";
import { ResponseWrapper } from "../lib/response-wrapper.js";
import * as models from "../models/index.js";
import { EnhancedTool, MaxToolRounds } from "../lib/tool-types.js";
/**
 * Input type that accepts both chat-style messages and responses-style input
 */
export type CallModelInput = models.OpenResponsesInput | models.Message[];
/**
 * Tool type that accepts chat-style, responses-style, or enhanced tools
 */
export type CallModelTools = EnhancedTool[] | models.ToolDefinitionJson[] | models.OpenResponsesRequest["tools"];
/**
 * Get a response with multiple consumption patterns
 *
 * @remarks
 * Creates a response using the OpenResponses API in streaming mode and returns
 * a wrapper that allows consuming the response in multiple ways:
 *
 * - `await response.getMessage()` - Get the completed message (tools auto-executed)
 * - `await response.getText()` - Get just the text content (tools auto-executed)
 * - `await response.getResponse()` - Get full response with usage data (inputTokens, cachedTokens, etc.)
 * - `for await (const delta of response.getTextStream())` - Stream text deltas
 * - `for await (const delta of response.getReasoningStream())` - Stream reasoning deltas
 * - `for await (const event of response.getToolStream())` - Stream tool events (incl. preliminary results)
 * - `for await (const toolCall of response.getToolCallsStream())` - Stream structured tool calls
 * - `await response.getToolCalls()` - Get all tool calls from completed response
 * - `for await (const msg of response.getNewMessagesStream())` - Stream incremental message updates
 * - `for await (const event of response.getFullResponsesStream())` - Stream all events (incl. tool preliminary)
 * - `for await (const event of response.getFullChatStream())` - Stream in chat format (incl. tool preliminary)
 *
 * All consumption patterns can be used concurrently on the same response.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * // Simple text extraction
 * const response = openrouter.callModel({
 *   model: "openai/gpt-4",
 *   input: "Hello!"
 * });
 * const text = await response.getText();
 * console.log(text);
 *
 * // With tools (automatic execution)
 * const response = openrouter.callModel({
 *   model: "openai/gpt-4",
 *   input: "What's the weather in SF?",
 *   tools: [{
 *     type: "function",
 *     function: {
 *       name: "get_weather",
 *       description: "Get current weather",
 *       inputSchema: z.object({
 *         location: z.string()
 *       }),
 *       outputSchema: z.object({
 *         temperature: z.number(),
 *         description: z.string()
 *       }),
 *       execute: async (params) => {
 *         return { temperature: 72, description: "Sunny" };
 *       }
 *     }
 *   }],
 *   maxToolRounds: 5, // or function: (context: TurnContext) => boolean
 * });
 * const message = await response.getMessage(); // Tools auto-executed!
 *
 * // Stream with preliminary results
 * for await (const event of response.getFullChatStream()) {
 *   if (event.type === "content.delta") {
 *     process.stdout.write(event.delta);
 *   } else if (event.type === "tool.preliminary_result") {
 *     console.log("Tool progress:", event.result);
 *   }
 * }
 * ```
 */
export declare function callModel(client: OpenRouterCore, request: Omit<models.OpenResponsesRequest, "stream" | "tools" | "input"> & {
    input?: CallModelInput;
    tools?: CallModelTools;
    maxToolRounds?: MaxToolRounds;
}, options?: RequestOptions): ResponseWrapper;
//# sourceMappingURL=callModel.d.ts.map
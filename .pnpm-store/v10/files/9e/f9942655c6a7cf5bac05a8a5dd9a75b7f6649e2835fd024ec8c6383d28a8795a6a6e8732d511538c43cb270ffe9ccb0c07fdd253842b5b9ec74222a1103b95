import { ResponseWrapper } from "../lib/response-wrapper.js";
import { convertEnhancedToolsToAPIFormat } from "../lib/tool-executor.js";
/**
 * Check if input is chat-style messages (Message[])
 */
function isChatStyleMessages(input) {
    if (!Array.isArray(input))
        return false;
    if (input.length === 0)
        return false;
    const first = input[0];
    // Chat-style messages have role but no 'type' field at top level
    // Responses-style items have 'type' field (like 'message', 'function_call', etc.)
    return first && 'role' in first && !('type' in first);
}
/**
 * Check if tools are chat-style (ToolDefinitionJson[])
 */
function isChatStyleTools(tools) {
    if (!Array.isArray(tools))
        return false;
    if (tools.length === 0)
        return false;
    const first = tools[0];
    // Chat-style tools have nested 'function' property with 'name' inside
    // Enhanced tools have 'function' with 'inputSchema'
    // Responses-style tools have 'name' at top level
    return first && 'function' in first && first.function && 'name' in first.function && !('inputSchema' in first.function);
}
/**
 * Convert chat-style tools to responses-style
 */
function convertChatToResponsesTools(tools) {
    return tools.map((tool) => ({
        type: "function",
        name: tool.function.name,
        description: tool.function.description ?? null,
        strict: tool.function.strict ?? null,
        parameters: tool.function.parameters ?? null,
    }));
}
/**
 * Convert chat-style messages to responses-style input
 */
function convertChatToResponsesInput(messages) {
    return messages.map((msg) => {
        // Extract extra fields like cache_control
        const { role, content, ...extraFields } = msg;
        if (role === "tool") {
            const toolMsg = msg;
            return {
                type: "function_call_output",
                callId: toolMsg.toolCallId,
                output: typeof toolMsg.content === "string" ? toolMsg.content : JSON.stringify(toolMsg.content),
                ...extraFields,
            };
        }
        // Handle assistant messages with tool calls
        if (role === "assistant") {
            const assistantMsg = msg;
            // If it has tool calls, we need to convert them
            // For now, just convert the content part
            return {
                role: "assistant",
                content: typeof assistantMsg.content === "string"
                    ? assistantMsg.content
                    : assistantMsg.content === null
                        ? ""
                        : JSON.stringify(assistantMsg.content),
                ...extraFields,
            };
        }
        // System, user, developer messages
        const convertedContent = typeof content === "string"
            ? content
            : content === null || content === undefined
                ? ""
                : JSON.stringify(content);
        return {
            role: role,
            content: convertedContent,
            ...extraFields,
        };
    });
}
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
export function callModel(client, request, options) {
    const { tools, maxToolRounds, input, ...restRequest } = request;
    // Convert chat-style messages to responses-style input if needed
    const convertedInput = input && isChatStyleMessages(input)
        ? convertChatToResponsesInput(input)
        : input;
    const apiRequest = {
        ...restRequest,
        input: convertedInput,
    };
    // Determine tool type and convert as needed
    let isEnhancedTools = false;
    let isChatTools = false;
    if (tools && Array.isArray(tools) && tools.length > 0) {
        const firstTool = tools[0];
        isEnhancedTools = "function" in firstTool && firstTool.function && "inputSchema" in firstTool.function;
        isChatTools = !isEnhancedTools && isChatStyleTools(tools);
    }
    const enhancedTools = isEnhancedTools ? tools : undefined;
    // Convert tools to API format based on their type
    let apiTools;
    if (enhancedTools) {
        apiTools = convertEnhancedToolsToAPIFormat(enhancedTools);
    }
    else if (isChatTools) {
        apiTools = convertChatToResponsesTools(tools);
    }
    else {
        apiTools = tools;
    }
    // Build the request with converted tools
    const finalRequest = {
        ...apiRequest,
        ...(apiTools && { tools: apiTools }),
    };
    const wrapperOptions = {
        client,
        request: finalRequest,
        options: options ?? {},
    };
    // Only pass enhanced tools to wrapper (needed for auto-execution)
    if (enhancedTools) {
        wrapperOptions.tools = enhancedTools;
    }
    if (maxToolRounds !== undefined) {
        wrapperOptions.maxToolRounds = maxToolRounds;
    }
    return new ResponseWrapper(wrapperOptions);
}
//# sourceMappingURL=callModel.js.map
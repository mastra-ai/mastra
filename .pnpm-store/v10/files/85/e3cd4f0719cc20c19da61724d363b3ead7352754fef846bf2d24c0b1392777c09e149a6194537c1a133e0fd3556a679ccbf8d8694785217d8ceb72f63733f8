import { z, type ZodType, type ZodObject, type ZodRawShape } from "zod/v4";
import * as models from "../models/index.js";
import type { OpenResponsesStreamEvent } from "../models/index.js";
/**
 * Tool type enum for enhanced tools
 */
export declare enum ToolType {
    Function = "function"
}
/**
 * Turn context passed to tool execute functions
 * Contains information about the current conversation state
 */
export interface TurnContext {
    /** Number of tool execution turns so far (1-indexed: first turn = 1) */
    numberOfTurns: number;
    /** Current message history being sent to the API */
    messageHistory: models.OpenResponsesInput;
    /** Model name if request.model is set */
    model?: string;
    /** Model names if request.models is set */
    models?: string[];
}
/**
 * Base tool function interface with inputSchema
 */
export interface BaseToolFunction<TInput extends ZodObject<ZodRawShape>> {
    name: string;
    description?: string;
    inputSchema: TInput;
}
/**
 * Regular tool with synchronous or asynchronous execute function and optional outputSchema
 */
export interface ToolFunctionWithExecute<TInput extends ZodObject<ZodRawShape>, TOutput extends ZodType = ZodType<any>> extends BaseToolFunction<TInput> {
    outputSchema?: TOutput;
    execute: (params: z.infer<TInput>, context?: TurnContext) => Promise<z.infer<TOutput>> | z.infer<TOutput>;
}
/**
 * Generator-based tool with async generator execute function
 * Emits preliminary events (validated by eventSchema) during execution
 * and a final output (validated by outputSchema) as the last emission
 *
 * @example
 * ```typescript
 * {
 *   eventSchema: z.object({ status: z.string() }),  // For progress events
 *   outputSchema: z.object({ result: z.number() }), // For final output
 *   execute: async function* (params) {
 *     yield { status: "processing..." };  // Event
 *     yield { status: "almost done..." }; // Event
 *     yield { result: 42 };               // Final output (must be last)
 *   }
 * }
 * ```
 */
export interface ToolFunctionWithGenerator<TInput extends ZodObject<ZodRawShape>, TEvent extends ZodType = ZodType<any>, TOutput extends ZodType = ZodType<any>> extends BaseToolFunction<TInput> {
    eventSchema: TEvent;
    outputSchema: TOutput;
    execute: (params: z.infer<TInput>, context?: TurnContext) => AsyncGenerator<z.infer<TEvent>>;
}
/**
 * Manual tool without execute function - requires manual handling by developer
 */
export interface ManualToolFunction<TInput extends ZodObject<ZodRawShape>, TOutput extends ZodType = ZodType<any>> extends BaseToolFunction<TInput> {
    outputSchema?: TOutput;
}
/**
 * Tool with execute function (regular or generator)
 */
export type ToolWithExecute<TInput extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>, TOutput extends ZodType = ZodType<any>> = {
    type: ToolType.Function;
    function: ToolFunctionWithExecute<TInput, TOutput>;
};
/**
 * Tool with generator execute function
 */
export type ToolWithGenerator<TInput extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>, TEvent extends ZodType = ZodType<any>, TOutput extends ZodType = ZodType<any>> = {
    type: ToolType.Function;
    function: ToolFunctionWithGenerator<TInput, TEvent, TOutput>;
};
/**
 * Tool without execute function (manual handling)
 */
export type ManualTool<TInput extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>, TOutput extends ZodType = ZodType<any>> = {
    type: ToolType.Function;
    function: ManualToolFunction<TInput, TOutput>;
};
/**
 * Union type of all enhanced tool types
 */
export type EnhancedTool = ToolWithExecute<any, any> | ToolWithGenerator<any, any> | ManualTool<any, any>;
/**
 * Type guard to check if a tool has an execute function
 */
export declare function hasExecuteFunction(tool: EnhancedTool): tool is ToolWithExecute | ToolWithGenerator;
/**
 * Type guard to check if a tool uses a generator (has eventSchema)
 */
export declare function isGeneratorTool(tool: EnhancedTool): tool is ToolWithGenerator;
/**
 * Type guard to check if a tool is a regular execution tool (not generator)
 */
export declare function isRegularExecuteTool(tool: EnhancedTool): tool is ToolWithExecute;
/**
 * Parsed tool call from API response
 */
export interface ParsedToolCall {
    id: string;
    name: string;
    arguments: unknown;
}
/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    result: unknown;
    preliminaryResults?: unknown[];
    error?: Error;
}
/**
 * Type for maxToolRounds - can be a number or a function that determines if execution should continue
 */
export type MaxToolRounds = number | ((context: TurnContext) => boolean);
/**
 * Result of executeTools operation
 */
export interface ExecuteToolsResult {
    finalResponse: any;
    allResponses: any[];
    toolResults: Map<string, {
        result: unknown;
        preliminaryResults?: unknown[];
    }>;
}
/**
 * Standard tool format for OpenRouter API (JSON Schema based)
 * Matches OpenResponsesRequestToolFunction structure
 */
export interface APITool {
    type: "function";
    name: string;
    description?: string | null;
    strict?: boolean | null;
    parameters: {
        [k: string]: any | null;
    } | null;
}
/**
 * Tool preliminary result event emitted during generator tool execution
 */
export type ToolPreliminaryResultEvent = {
    type: "tool.preliminary_result";
    toolCallId: string;
    result: unknown;
    timestamp: number;
};
/**
 * Enhanced stream event types for getFullResponsesStream
 * Extends OpenResponsesStreamEvent with tool preliminary results
 */
export type EnhancedResponseStreamEvent = OpenResponsesStreamEvent | ToolPreliminaryResultEvent;
/**
 * Type guard to check if an event is a tool preliminary result event
 */
export declare function isToolPreliminaryResultEvent(event: EnhancedResponseStreamEvent): event is ToolPreliminaryResultEvent;
/**
 * Tool stream event types for getToolStream
 * Includes both argument deltas and preliminary results
 */
export type ToolStreamEvent = {
    type: "delta";
    content: string;
} | {
    type: "preliminary_result";
    toolCallId: string;
    result: unknown;
};
/**
 * Chat stream event types for getFullChatStream
 * Includes content deltas, completion events, and tool preliminary results
 */
export type ChatStreamEvent = {
    type: "content.delta";
    delta: string;
} | {
    type: "message.complete";
    response: any;
} | {
    type: "tool.preliminary_result";
    toolCallId: string;
    result: unknown;
} | {
    type: string;
    event: any;
};
//# sourceMappingURL=tool-types.d.ts.map
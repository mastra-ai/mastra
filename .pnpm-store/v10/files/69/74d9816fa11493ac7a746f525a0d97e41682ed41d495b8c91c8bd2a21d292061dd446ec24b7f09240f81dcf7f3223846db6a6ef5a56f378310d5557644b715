import { type ZodType } from "zod/v4";
import { EnhancedTool, ToolExecutionResult, ParsedToolCall, APITool, TurnContext } from "./tool-types.js";
/**
 * Convert a Zod schema to JSON Schema using Zod v4's toJSONSchema function
 */
export declare function convertZodToJsonSchema(zodSchema: ZodType): Record<string, any>;
/**
 * Convert enhanced tools to OpenRouter API format
 */
export declare function convertEnhancedToolsToAPIFormat(tools: EnhancedTool[]): APITool[];
/**
 * Validate tool input against Zod schema
 * @throws ZodError if validation fails
 */
export declare function validateToolInput<T>(schema: ZodType<T>, args: unknown): T;
/**
 * Validate tool output against Zod schema
 * @throws ZodError if validation fails
 */
export declare function validateToolOutput<T>(schema: ZodType<T>, result: unknown): T;
/**
 * Parse tool call arguments from JSON string
 */
export declare function parseToolCallArguments(argumentsString: string): unknown;
/**
 * Execute a regular (non-generator) tool
 */
export declare function executeRegularTool(tool: EnhancedTool, toolCall: ParsedToolCall, context: TurnContext): Promise<ToolExecutionResult>;
/**
 * Execute a generator tool and collect preliminary and final results
 * - Intermediate yields are validated against eventSchema (preliminary events)
 * - Last yield is validated against outputSchema (final result sent to model)
 * - Generator must emit at least one value
 */
export declare function executeGeneratorTool(tool: EnhancedTool, toolCall: ParsedToolCall, context: TurnContext, onPreliminaryResult?: (toolCallId: string, result: unknown) => void): Promise<ToolExecutionResult>;
/**
 * Execute a tool call
 * Automatically detects if it's a regular or generator tool
 */
export declare function executeTool(tool: EnhancedTool, toolCall: ParsedToolCall, context: TurnContext, onPreliminaryResult?: (toolCallId: string, result: unknown) => void): Promise<ToolExecutionResult>;
/**
 * Find a tool by name in the tools array
 */
export declare function findToolByName(tools: EnhancedTool[], name: string): EnhancedTool | undefined;
/**
 * Format tool execution result as a string for sending to the model
 */
export declare function formatToolResultForModel(result: ToolExecutionResult): string;
/**
 * Create a user-friendly error message for tool execution errors
 */
export declare function formatToolExecutionError(error: Error, toolCall: ParsedToolCall): string;
//# sourceMappingURL=tool-executor.d.ts.map
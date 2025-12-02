import * as models from "../models/index.js";
import { EnhancedTool, ToolExecutionResult } from "./tool-types.js";
/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
    maxRounds?: number;
    onPreliminaryResult?: (toolCallId: string, result: unknown) => void;
}
/**
 * Result of the tool execution loop
 */
export interface ToolOrchestrationResult {
    finalResponse: models.OpenResponsesNonStreamingResponse;
    allResponses: models.OpenResponsesNonStreamingResponse[];
    toolExecutionResults: ToolExecutionResult[];
    conversationInput: models.OpenResponsesInput;
}
/**
 * Execute tool calls and manage multi-turn conversations
 * This orchestrates the loop of: request -> tool calls -> execute -> send results -> repeat
 *
 * @param sendRequest - Function to send a request and get a response
 * @param initialInput - Starting input for the conversation
 * @param tools - Enhanced tools with Zod schemas and execute functions
 * @param apiTools - Converted tools in API format (JSON Schema)
 * @param options - Execution options
 * @returns Result containing final response and all execution data
 */
export declare function executeToolLoop(sendRequest: (input: models.OpenResponsesInput, tools: any[]) => Promise<models.OpenResponsesNonStreamingResponse>, initialInput: models.OpenResponsesInput, tools: EnhancedTool[], apiTools: any[], options?: ToolExecutionOptions): Promise<ToolOrchestrationResult>;
/**
 * Convert tool execution results to a map for easy lookup
 */
export declare function toolResultsToMap(results: ToolExecutionResult[]): Map<string, {
    result: unknown;
    preliminaryResults?: unknown[];
}>;
/**
 * Build a summary of tool executions for debugging/logging
 */
export declare function summarizeToolExecutions(results: ToolExecutionResult[]): string;
/**
 * Check if any tool executions had errors
 */
export declare function hasToolExecutionErrors(results: ToolExecutionResult[]): boolean;
/**
 * Get all tool execution errors
 */
export declare function getToolExecutionErrors(results: ToolExecutionResult[]): Error[];
//# sourceMappingURL=tool-orchestrator.d.ts.map
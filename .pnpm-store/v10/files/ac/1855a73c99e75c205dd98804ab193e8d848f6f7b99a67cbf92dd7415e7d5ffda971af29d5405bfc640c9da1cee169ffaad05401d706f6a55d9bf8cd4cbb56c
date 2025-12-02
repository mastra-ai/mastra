import { ZodError, toJSONSchema } from "zod/v4";
import { hasExecuteFunction, isGeneratorTool, isRegularExecuteTool, } from "./tool-types.js";
/**
 * Convert a Zod schema to JSON Schema using Zod v4's toJSONSchema function
 */
export function convertZodToJsonSchema(zodSchema) {
    const jsonSchema = toJSONSchema(zodSchema, {
        target: "openapi-3.0",
    });
    return jsonSchema;
}
/**
 * Convert enhanced tools to OpenRouter API format
 */
export function convertEnhancedToolsToAPIFormat(tools) {
    return tools.map((tool) => ({
        type: "function",
        name: tool.function.name,
        description: tool.function.description || null,
        strict: null,
        parameters: convertZodToJsonSchema(tool.function.inputSchema),
    }));
}
/**
 * Validate tool input against Zod schema
 * @throws ZodError if validation fails
 */
export function validateToolInput(schema, args) {
    return schema.parse(args);
}
/**
 * Validate tool output against Zod schema
 * @throws ZodError if validation fails
 */
export function validateToolOutput(schema, result) {
    return schema.parse(result);
}
/**
 * Parse tool call arguments from JSON string
 */
export function parseToolCallArguments(argumentsString) {
    try {
        return JSON.parse(argumentsString);
    }
    catch (error) {
        throw new Error(`Failed to parse tool call arguments: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Execute a regular (non-generator) tool
 */
export async function executeRegularTool(tool, toolCall, context) {
    if (!isRegularExecuteTool(tool)) {
        throw new Error(`Tool "${toolCall.name}" is not a regular execute tool or has no execute function`);
    }
    try {
        // Validate input
        const validatedInput = validateToolInput(tool.function.inputSchema, toolCall.arguments);
        // Execute tool with context
        const result = await Promise.resolve(tool.function.execute(validatedInput, context));
        // Validate output if schema is provided
        if (tool.function.outputSchema) {
            const validatedOutput = validateToolOutput(tool.function.outputSchema, result);
            return {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                result: validatedOutput,
            };
        }
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result,
        };
    }
    catch (error) {
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: null,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
/**
 * Execute a generator tool and collect preliminary and final results
 * - Intermediate yields are validated against eventSchema (preliminary events)
 * - Last yield is validated against outputSchema (final result sent to model)
 * - Generator must emit at least one value
 */
export async function executeGeneratorTool(tool, toolCall, context, onPreliminaryResult) {
    if (!isGeneratorTool(tool)) {
        throw new Error(`Tool "${toolCall.name}" is not a generator tool`);
    }
    try {
        // Validate input
        const validatedInput = validateToolInput(tool.function.inputSchema, toolCall.arguments);
        // Execute generator and collect all results
        const preliminaryResults = [];
        let lastEmittedValue = null;
        let hasEmittedValue = false;
        for await (const event of tool.function.execute(validatedInput, context)) {
            hasEmittedValue = true;
            // Validate event against eventSchema
            const validatedEvent = validateToolOutput(tool.function.eventSchema, event);
            preliminaryResults.push(validatedEvent);
            lastEmittedValue = validatedEvent;
            // Emit preliminary result via callback
            if (onPreliminaryResult) {
                onPreliminaryResult(toolCall.id, validatedEvent);
            }
        }
        // Generator must emit at least one value
        if (!hasEmittedValue) {
            throw new Error(`Generator tool "${toolCall.name}" completed without emitting any values`);
        }
        // Validate the last emitted value against outputSchema (this is the final result)
        const finalResult = validateToolOutput(tool.function.outputSchema, lastEmittedValue);
        // Remove last item from preliminaryResults since it's the final output
        preliminaryResults.pop();
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: finalResult,
            preliminaryResults,
        };
    }
    catch (error) {
        return {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: null,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
/**
 * Execute a tool call
 * Automatically detects if it's a regular or generator tool
 */
export async function executeTool(tool, toolCall, context, onPreliminaryResult) {
    if (!hasExecuteFunction(tool)) {
        throw new Error(`Tool "${toolCall.name}" has no execute function. Use manual tool execution.`);
    }
    if (isGeneratorTool(tool)) {
        return executeGeneratorTool(tool, toolCall, context, onPreliminaryResult);
    }
    return executeRegularTool(tool, toolCall, context);
}
/**
 * Find a tool by name in the tools array
 */
export function findToolByName(tools, name) {
    return tools.find((tool) => tool.function.name === name);
}
/**
 * Format tool execution result as a string for sending to the model
 */
export function formatToolResultForModel(result) {
    if (result.error) {
        return JSON.stringify({
            error: result.error.message,
            toolName: result.toolName,
        });
    }
    return JSON.stringify(result.result);
}
/**
 * Create a user-friendly error message for tool execution errors
 */
export function formatToolExecutionError(error, toolCall) {
    if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
        }));
        return `Tool "${toolCall.name}" validation error:\n${JSON.stringify(issues, null, 2)}`;
    }
    return `Tool "${toolCall.name}" execution error: ${error.message}`;
}
//# sourceMappingURL=tool-executor.js.map
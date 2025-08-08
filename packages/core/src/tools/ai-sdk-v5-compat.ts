import type { FlexibleSchema } from '@ai-sdk/provider-utils';
import { convertSchemaToZod, convertZodSchemaToAISDKSchema } from '@mastra/schema-compat';
import type { Tool, Schema } from 'ai';
import type { JSONSchema7Type } from 'json-schema';
import type * as z3 from 'zod/v3';
import type * as z4 from 'zod/v4/core';

import type { CoreTool, ToolParameters, VercelTool, ToolAction } from './types';

/**
 * Type guard to check if a tool is a Vercel AI SDK v5 Tool
 */
export function isVercelV5Tool(tool: unknown): tool is Tool<any, any> {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'inputSchema' in tool &&
    'execute' in tool &&
    typeof (tool as any).execute === 'function' &&
    // Exclude Mastra tools by checking for the unique __isMastraTool property
    !('__isMastraTool' in tool) &&
    // Check for v5-specific properties (and NOT Mastra Tool properties)
    (!('parameters' in tool) || (tool as any).parameters === undefined)
  );
}

/**
 * Simple type guard for CoreTool with vercel-v5-tool type
 */
export function isCoreToolWithVercelV5(tool: unknown): tool is CoreTool & { type: 'vercel-v5-tool' } {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'type' in tool &&
    (tool as any).type === 'vercel-v5-tool' &&
    'tool' in tool
  );
}

/**
 * Type guard to check if a tool has streaming callbacks (v5 feature)
 */
export function hasStreamingCallbacks(tool: unknown): boolean {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    (('onInputStart' in tool && typeof (tool as any).onInputStart === 'function') ||
      ('onInputDelta' in tool && typeof (tool as any).onInputDelta === 'function') ||
      ('onInputAvailable' in tool && typeof (tool as any).onInputAvailable === 'function'))
  );
}

/**
 * Converts a FlexibleSchema to a Mastra-compatible ToolParameters type
 */
export function convertFlexibleSchemaToToolParameters(schema: FlexibleSchema<any>): ToolParameters {
  // FlexibleSchema can be Zod v3, Zod v4, or AI SDK Schema
  // We need to determine which type and convert appropriately

  if (typeof schema === 'object' && schema !== null) {
    // Check if it's a Zod schema (v3 or v4)
    if ('_def' in schema && 'parse' in schema && 'safeParse' in schema) {
      return schema as z4.$ZodType<any> | z3.Schema<any>;
    }

    // Check if it's an AI SDK Schema
    if ('jsonSchema' in schema && 'validate' in schema) {
      return schema as Schema<any>;
    }

    // Fallback to treating as JSONSchema7Type with proper casting
    return schema as unknown as JSONSchema7Type;
  }

  // Default fallback
  return schema as ToolParameters;
}

/**
 * Converts Mastra ToolParameters to FlexibleSchema
 */
export function convertToolParametersToFlexibleSchema(parameters: ToolParameters): FlexibleSchema<any> {
  // ToolParameters can be Zod v3, Zod v4, AI SDK Schema, or JSONSchema7Type
  // FlexibleSchema accepts Zod v3, Zod v4, or AI SDK Schema

  if (typeof parameters === 'object' && parameters !== null) {
    // Check if it's already a Zod schema (v3 or v4)
    if ('_def' in parameters && 'parse' in parameters && 'safeParse' in parameters) {
      return parameters as FlexibleSchema<any>;
    }

    // Check if it's an AI SDK Schema
    if ('jsonSchema' in parameters && 'validate' in parameters) {
      return parameters as Schema<any>;
    }

    // If it's JSONSchema7Type, convert to AI SDK Schema
    try {
      return convertZodSchemaToAISDKSchema(convertSchemaToZod(parameters as any));
    } catch {
      // Fallback - create a simple object schema
      return convertZodSchemaToAISDKSchema(convertSchemaToZod({} as any));
    }
  }

  // Fallback - create a simple object schema
  return convertZodSchemaToAISDKSchema(convertSchemaToZod({} as any));
}

/**
 * Converts a Mastra CoreTool to a Vercel AI SDK v5 Tool
 */
export function convertMastraToolToVercelTool<TInput = any, TOutput = any>(
  mastraTool: CoreTool<ToolParameters>,
  options?: {
    onInputStart?: (options: { toolCallId: string }) => void;
    onInputDelta?: (options: { inputTextDelta: string; toolCallId: string }) => void;
    onInputAvailable?: (options: { input: TInput; toolCallId: string }) => void;
  },
): Tool<TInput, TOutput> {
  // First check if it's already a Tool (from the CoreTool union)
  if (isVercelV5Tool(mastraTool)) {
    return mastraTool as Tool<TInput, TOutput>;
  }

  // Cast to Mastra tool type to access properties safely
  const tool = mastraTool as any;

  // Handle regular function tools
  const vercelTool = {
    description: tool.description,
    inputSchema: convertToolParametersToFlexibleSchema(tool.inputSchema || {}),
    execute: tool.execute,
    ...options,
  } as unknown as Tool<TInput, TOutput>;

  return vercelTool;
}

/**
 * Converts a Vercel AI SDK v5 Tool to a Mastra CoreTool
 */
export function convertVercelToolToMastraTool<TParameters = ToolParameters>(
  vercelTool: Tool<any, any>,
): CoreTool<TParameters> {
  const tool = vercelTool as any;

  // Handle regular function tools
  const mastraTool = {
    type: 'function' as const,
    description: tool.description,
    inputSchema: convertFlexibleSchemaToToolParameters(tool.inputSchema || {}) as TParameters,
    execute: tool.execute,
  } as CoreTool<TParameters>;

  return mastraTool;
}

/**
 * Creates a compatible tool set that can contain both Mastra and Vercel tools
 */
export function createCompatibleToolSet<T extends Record<string, any>>(tools: T): Record<keyof T, Tool<any, any>> {
  const compatibleTools: Record<string, Tool<any, any>> = {};

  for (const [key, tool] of Object.entries(tools)) {
    if (isVercelV5Tool(tool)) {
      // Already a Vercel tool, use as-is
      compatibleTools[key] = tool;
    } else if (isCoreToolWithVercelV5(tool)) {
      // Extract the wrapped Vercel tool
      compatibleTools[key] = (tool as any).tool;
    } else {
      // Convert Mastra tool to Vercel tool
      compatibleTools[key] = convertMastraToolToVercelTool(tool as CoreTool<ToolParameters>);
    }
  }

  return compatibleTools as Record<keyof T, Tool<any, any>>;
}

/**
 * Enhanced tool type that supports both Mastra and Vercel formats
 */
export type CompatibleTool<TParameters = ToolParameters> =
  | CoreTool<TParameters>
  | Tool<any, any>
  | VercelTool
  | ToolAction<any, any, any>;

/**
 * Tool set type that supports mixed Mastra and Vercel tools
 */
export type CompatibleToolSet = Record<string, CompatibleTool>;

/**
 * Utility to ensure a tool is in Vercel format for AI SDK v5 compatibility
 */
export function ensureVercelTool(tool: CompatibleTool): Tool<any, any> {
  if (isVercelV5Tool(tool)) {
    return tool;
  }

  return convertMastraToolToVercelTool(tool as CoreTool<ToolParameters>);
}

/**
 * Utility to ensure a tool is in Mastra format
 */
export function ensureMastraTool(tool: CompatibleTool): CoreTool<ToolParameters> {
  if (isVercelV5Tool(tool)) {
    return convertVercelToolToMastraTool(tool);
  }

  return tool as CoreTool<ToolParameters>;
}

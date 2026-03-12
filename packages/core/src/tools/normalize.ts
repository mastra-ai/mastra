import { toStandardSchema } from '../schema';
import type { ToolToConvert } from './tool-builder/builder';
import { isProviderDefinedTool, isVercelTool, isMastraTool } from './toolchecks';

/**
 * Normalizes Vercel/AI SDK tools into Mastra-native tool format.
 * This ensures all tools passed through the system use Mastra's StandardSchema
 * and ToolAction interface before being converted to AI SDK format at the boundary.
 *
 * The key difference: Vercel tools use 'parameters', Mastra tools use 'inputSchema'.
 * This function renames the property while preserving the tool's original execute signature
 * and all other metadata. The AISDKToolConverter will later handle execute signature conversion.
 *
 * @param tool - The tool to normalize (can be Mastra Tool, ToolAction, or Vercel tool)
 * @returns The tool with Mastra-standard naming (inputSchema vs parameters)
 *
 * @example
 * ```typescript
 * // Vercel tool with AI SDK schema
 * const vercelTool = {
 *   description: 'Get weather',
 *   parameters: z.object({ location: z.string() }),
 *   execute: async (input) => fetchWeather(input.location)
 * };
 *
 * // Normalize to Mastra format
 * const mastraTool = normalizeToMastraTool(vercelTool);
 * // Now has inputSchema instead of parameters
 * // Execute signature unchanged (AISDKToolConverter will handle that)
 * ```
 */
export function normalizeToMastraTool(tool: ToolToConvert): ToolToConvert {
  // If it's already a Mastra Tool instance or ToolAction, return as-is
  if (isMastraTool(tool)) {
    return tool;
  }

  // If it already has 'inputSchema' (not 'parameters'), it's in Mastra format
  if ('inputSchema' in tool && !('parameters' in tool)) {
    return tool;
  }

  // Provider-defined tools pass through as-is - they have special handling in AISDKToolConverter
  if (isProviderDefinedTool(tool)) {
    return tool;
  }

  // If it's a Vercel tool with 'parameters', rename to 'inputSchema'
  if (isVercelTool(tool) && 'parameters' in tool) {
    const { parameters, ...rest } = tool as any;
    return {
      ...rest,
      inputSchema: toStandardSchema(parameters),
    } as ToolToConvert;
  }

  // Fallback: return as-is
  return tool;
}

/**
 * Batch normalization for a record of tools.
 * Normalizes all tools in the record to Mastra format.
 *
 * @param tools - Record of tools to normalize
 * @returns Record with all tools normalized to Mastra format
 *
 * @example
 * ```typescript
 * const tools = {
 *   weather: vercelWeatherTool,
 *   search: mastraSearchTool
 * };
 *
 * const normalized = normalizeToolsRecord(tools);
 * // All tools now use Mastra format (inputSchema instead of parameters)
 * ```
 */
export function normalizeToolsRecord<T extends Record<string, ToolToConvert>>(
  tools: T,
): Record<keyof T, ToolToConvert> {
  const normalized: Record<string, ToolToConvert> = {};

  for (const [key, tool] of Object.entries(tools)) {
    normalized[key] = normalizeToMastraTool(tool);
  }

  return normalized as Record<keyof T, ToolToConvert>;
}

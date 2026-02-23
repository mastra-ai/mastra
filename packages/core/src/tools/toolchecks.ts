import { Tool, MASTRA_TOOL_MARKER } from './tool';
import type { ToolToConvert } from './tool-builder/builder';
import type { VercelTool } from './types';

/**
 * Checks if a tool is a Mastra Tool, using both instanceof and marker.
 * The marker fallback handles environments like Vite SSR where the same
 * module may be loaded multiple times, causing instanceof to fail.
 */
function isMastraTool(tool: unknown): boolean {
  return tool instanceof Tool || (typeof tool === 'object' && tool !== null && MASTRA_TOOL_MARKER in tool);
}

/**
 * Checks if a tool is a Vercel Tool (AI SDK tool)
 * @param tool - The tool to check
 * @returns True if the tool is a Vercel Tool, false otherwise
 */
export function isVercelTool(tool?: ToolToConvert): tool is VercelTool {
  // Checks if this tool is not an instance of Mastra's Tool class
  // AI SDK tools must have an execute function and either:
  // - 'parameters' (v4) or 'inputSchema' (v5/v6)
  // This prevents plain objects with inputSchema (like client tools) from being treated as VercelTools
  return !!(
    tool &&
    !isMastraTool(tool) &&
    ('parameters' in tool || ('execute' in tool && typeof tool.execute === 'function' && 'inputSchema' in tool))
  );
}

/**
 * Checks if a tool is a provider-defined tool from the AI SDK.
 * Provider tools (like openai.tools.webSearch()) are created by the AI SDK with:
 * - type: "provider-defined" (AI SDK v5) or "provider" (AI SDK v6)
 * - id: in format 'provider.tool_name' (e.g., 'openai.web_search')
 */
export function isProviderTool(
  tool: unknown,
): tool is { type: 'provider-defined' | 'provider'; id: string; args?: Record<string, unknown> } {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Record<string, unknown>;
  const isProviderType = t.type === 'provider-defined' || t.type === 'provider';
  return isProviderType && typeof t.id === 'string';
}

/**
 * Extracts the model-facing tool name from a provider tool id.
 * e.g., 'openai.web_search' -> 'web_search'
 */
export function getProviderToolName(providerId: string): string {
  return providerId.split('.').slice(1).join('.');
}

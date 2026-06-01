import { Tool, MASTRA_TOOL_MARKER } from './tool';
import type { ToolToConvert } from './tool-builder/builder';
import type { NeedsApprovalFn, VercelTool } from './types';

/**
 * Checks if a tool is a Mastra Tool, using both instanceof and marker.
 * The marker fallback handles environments like Vite SSR where the same
 * module may be loaded multiple times, causing instanceof to fail.
 */
export function isMastraTool(tool: unknown): boolean {
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

type ProviderTool = {
  type: 'provider-defined' | 'provider';
  id: string;
  args?: Record<string, unknown>;
  inputSchema?: unknown;
  outputSchema?: unknown;
  requestContextSchema?: unknown;
};

/**
 * Checks if a tool is a provider-defined tool from the AI SDK.
 * Provider tools (like google.tools.googleSearch(), openai.tools.webSearch()) have:
 * - type: "provider-defined" (AI SDK v5) or "provider" (AI SDK v6)
 * - id: in format 'provider.tool_name' (e.g., 'google.google_search')
 *
 * These tools have a lazy `inputSchema` function that returns an AI SDK Schema
 * (not a Zod schema), so they require special handling during serialization.
 */
export function isProviderDefinedTool(tool: unknown): tool is ProviderTool {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Record<string, unknown>;
  const isProviderType = t.type === 'provider-defined' || t.type === 'provider';
  return isProviderType && typeof t.id === 'string';
}

/**
 * Alias for callers that prefer the shorter provider-tool terminology.
 */
export const isProviderTool = isProviderDefinedTool;

/**
 * Extracts the model-facing tool name from a provider tool id.
 * e.g. 'openai.web_search' -> 'web_search'
 */
export function getProviderToolName(providerId: string): string {
  return providerId.split('.').slice(1).join('.');
}

/**
 * Reads a per-tool {@link NeedsApprovalFn} attached to a tool instance, if present.
 *
 * Runtime tool maps are loosely typed (AI SDK `ToolSet` shape plus Mastra extras), so the
 * `needsApprovalFn` decided by {@link CoreToolBuilder} / the MCP client is read off an
 * arbitrary tool-like value. This helper centralizes that access with a typed result so the
 * runtime never has to reach through `any` for it.
 */
export function getNeedsApprovalFn(tool: unknown): NeedsApprovalFn | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined;
  const fn = (tool as { needsApprovalFn?: unknown }).needsApprovalFn;
  return typeof fn === 'function' ? (fn as NeedsApprovalFn) : undefined;
}

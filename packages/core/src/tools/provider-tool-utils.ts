/**
 * Operational utilities for handling provider-defined and gateway tools
 * in the agentic loop.
 *
 * Type-checking predicates (isProviderDefinedTool, isGatewayTool) live in
 * toolchecks.ts alongside isVercelTool. This file re-exports them for
 * convenience and adds higher-level helpers used by the execution steps.
 */

import { isProviderDefinedTool } from './toolchecks';

export { isGatewayTool, isProviderDefinedTool } from './toolchecks';

/**
 * Infers the providerExecuted flag for a tool call.
 *
 * When the raw stream from doStream doesn't include providerExecuted on a tool-call,
 * we infer it based on the tool definition:
 * - Provider tools (type: 'provider'/'provider-defined') → providerExecuted: true
 * - Regular function tools → leave as undefined
 */
export function inferProviderExecuted(providerExecuted: boolean | undefined, tool: unknown): boolean | undefined {
  if (providerExecuted !== undefined) return providerExecuted;
  return isProviderDefinedTool(tool) ? true : undefined;
}

/**
 * Find a tool in the tools set by name or by provider tool ID.
 *
 * Provider tools may be registered under a user-chosen key (e.g., 'web_search')
 * but have an internal ID (e.g., 'gateway.perplexity_search'). The stream may
 * use either the registered name or the ID-derived name.
 */
export function findToolByName(tools: Record<string, unknown> | undefined, toolName: string): unknown | undefined {
  if (!tools) return undefined;
  // Direct match by key
  if (tools[toolName]) return tools[toolName];
  // Match by provider tool ID
  return Object.values(tools).find((t: any) => 'id' in t && t.id === toolName);
}

/**
 * Operational utilities for handling provider-defined and gateway tools
 * in the agentic loop.
 *
 * Type-checking predicates (isProviderDefinedTool, isGatewayTool) live in
 * toolchecks.ts alongside isVercelTool. This file re-exports them for
 * convenience and adds higher-level helpers used by the execution steps.
 */

import type { ToolSet } from '@internal/ai-sdk-v5';

import { isProviderDefinedTool } from './toolchecks';

export { isGatewayTool, isProviderDefinedTool } from './toolchecks';

/**
 * Find a provider-defined tool by its registered key or provider ID.
 *
 * Provider tools may be registered under a user-chosen key (e.g., 'perplexitySearch')
 * but have an internal ID (e.g., 'gateway.perplexity_search'). The LLM stream may
 * reference the tool by its model-facing name (e.g., 'perplexity_search'), which is
 * the part after the provider prefix. This function checks:
 * 1. Direct key lookup in the tools map
 * 2. Full ID match (e.g., 'gateway.perplexity_search')
 * 3. Suffix match after the provider prefix (e.g., 'perplexity_search' matches 'gateway.perplexity_search')
 *
 * Only provider-defined tools are matched; regular function tools are ignored.
 */
export function findProviderToolByName(tools: ToolSet | undefined, toolName: string) {
  if (!tools) return undefined;

  // 1. Direct key lookup
  const tool = tools[toolName];
  if (isProviderDefinedTool(tool)) return tool;

  // 2. Iterate all tools to match by full ID or suffix after the provider prefix
  //    e.g., toolName 'perplexity_search' matches tool.id 'gateway.perplexity_search'
  for (const t of Object.values(tools)) {
    if (isProviderDefinedTool(t)) {
      if (t.id === toolName) return t;
      // Match by suffix: 'provider.tool_name' → check if 'tool_name' === toolName
      const dotIndex = t.id.indexOf('.');
      if (dotIndex !== -1 && t.id.slice(dotIndex + 1) === toolName) return t;
    }
  }

  return undefined;
}

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

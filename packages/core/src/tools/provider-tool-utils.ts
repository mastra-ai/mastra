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
 * Provider tools may be registered under a user-chosen key (e.g., 'web_search')
 * but have an internal ID (e.g., 'gateway.perplexity_search'). The stream may
 * reference the tool by either name. Only provider-defined tools are matched;
 * regular function tools are ignored.
 */
export function findProviderToolByName(tools: ToolSet | undefined, toolName: string) {
  if (!tools) return undefined;
  const tool = tools[toolName];
  if (isProviderDefinedTool(tool)) return tool;
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

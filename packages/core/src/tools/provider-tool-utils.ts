/**
 * Utility functions for identifying and handling provider-defined and gateway tools.
 *
 * Provider tools are tools defined by AI SDK providers (e.g., openai.tools.webSearch()).
 * Gateway tools are a subset of provider tools routed through the AI Gateway
 * (e.g., gateway.tools.perplexitySearch()).
 *
 * The distinction matters because:
 * - Native provider tools (like OpenAI web_search) have results stored server-side;
 *   the LLM can reference them via item_reference.
 * - Gateway tools are provider-executed but the LLM provider does NOT store results;
 *   they must be sent back as regular tool messages.
 */

/**
 * Checks if a tool is a provider-defined tool from the AI SDK.
 * Provider tools (like openai.tools.webSearch()) are created by the AI SDK with:
 * - type: "provider-defined" (AI SDK v5) or "provider" (AI SDK v6)
 * - id: in format 'provider.tool_name' (e.g., 'openai.web_search')
 */
export function isProviderDefinedTool(
  tool: unknown,
): tool is { type: string; id: string; args?: Record<string, unknown> } {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Record<string, unknown>;
  const isProviderType = t.type === 'provider-defined' || t.type === 'provider';
  return isProviderType && typeof t.id === 'string';
}

/**
 * Checks if a tool is a gateway tool based on its definition.
 * Gateway tools are provider-executed but their results need to be sent
 * to the LLM as regular tool results since the LLM provider
 * doesn't have them stored.
 *
 * Gateway tools have an ID starting with 'gateway.' (e.g., 'gateway.perplexity_search').
 */
export function isGatewayTool(tool: unknown): boolean {
  return isProviderDefinedTool(tool) && tool.id.startsWith('gateway.');
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

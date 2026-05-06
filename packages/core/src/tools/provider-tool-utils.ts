import type { Tool, ToolSet } from '@internal/ai-sdk-v5';
import { getProviderToolName, isProviderTool } from './toolchecks';

/**
 * Find a provider-defined tool by its model-facing name.
 */
export function findProviderToolByName(tools: ToolSet | undefined, toolName: string): Tool | undefined {
  if (!tools) return undefined;
  return Object.values(tools).find(
    t => isProviderTool(t) && (getProviderToolName(t.id) === toolName || (t as any).name === toolName),
  );
}

/**
 * Infers the providerExecuted flag for a tool call.
 *
 * When the raw stream from doStream doesn't include providerExecuted on a tool-call,
 * we infer it based on the tool definition:
 * - Provider tools with a custom execute → providerExecuted: false (user handles execution)
 * - Provider tools without execute → providerExecuted: true (provider handles execution)
 * - Regular function tools → leave as undefined
 */
export function inferProviderExecuted(providerExecuted: boolean | undefined, tool: unknown): boolean | undefined {
  if (providerExecuted !== undefined) return providerExecuted;
  if (!isProviderTool(tool)) return undefined;
  const hasExecute =
    typeof tool === 'object' && tool !== null && 'execute' in tool && typeof (tool as any).execute === 'function';
  return !hasExecute;
}

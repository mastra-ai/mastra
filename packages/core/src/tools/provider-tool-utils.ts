import type { ToolSet } from '@internal/ai-sdk-v5';
import { getProviderToolName } from '../stream/aisdk/v5/compat/prepare-tools';
import { isProviderDefinedTool } from './toolchecks';

/**
 * Find a provider-defined tool by its model-facing name.
 */
export function findProviderToolByName(tools: ToolSet | undefined, toolName: string) {
  if (!tools) return undefined;
  return Object.values(tools).find(t => isProviderDefinedTool(t) && getProviderToolName(t.id) === toolName);
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

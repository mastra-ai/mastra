import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2ToolChoice,
} from '@ai-sdk/provider-v5';
import type {
  LanguageModelV3FunctionTool,
  LanguageModelV3ProviderTool,
  LanguageModelV3ToolChoice,
} from '@ai-sdk/provider-v6';
import { asSchema, tool as toolFn } from '@internal/ai-sdk-v5';
import type { Tool, ToolChoice } from '@internal/ai-sdk-v5';

/** Model specification version for tool type conversion */
export type ModelSpecVersion = 'v2' | 'v3';

/** Combined tool types for both V2 and V3 */
type PreparedTool =
  | LanguageModelV2FunctionTool
  | LanguageModelV2ProviderDefinedTool
  | LanguageModelV3FunctionTool
  | LanguageModelV3ProviderTool;

type PreparedToolChoice = LanguageModelV2ToolChoice | LanguageModelV3ToolChoice;

/**
 * Checks if a tool is a provider tool by examining its id property.
 * Provider tools have an id in the format '<provider>.<tool_name>' (e.g., 'openai.web_search').
 * This works for both V5 and V6 provider tools.
 */
function isProviderTool(tool: unknown): tool is { id: string; args?: Record<string, unknown> } {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Record<string, unknown>;
  // Check for id property with provider prefix format
  return typeof t.id === 'string' && t.id.includes('.');
}

/**
 * Extracts the tool name from a provider tool id.
 * e.g., 'openai.web_search' -> 'web_search'
 */
function getProviderToolName(providerId: string): string {
  return providerId.split('.').slice(1).join('.');
}

export function prepareToolsAndToolChoice<TOOLS extends Record<string, Tool>>({
  tools,
  toolChoice,
  activeTools,
  targetVersion = 'v2',
}: {
  tools: TOOLS | undefined;
  toolChoice: ToolChoice<TOOLS> | undefined;
  activeTools: Array<keyof TOOLS> | undefined;
  /** Target model version: 'v2' for AI SDK v5, 'v3' for AI SDK v6. Defaults to 'v2'. */
  targetVersion?: ModelSpecVersion;
}): {
  tools: PreparedTool[] | undefined;
  toolChoice: PreparedToolChoice | undefined;
} {
  if (Object.keys(tools || {}).length === 0) {
    return {
      tools: undefined,
      toolChoice: undefined,
    };
  }

  // when activeTools is provided, we only include the tools that are in the list:
  const filteredTools =
    activeTools != null
      ? Object.entries(tools || {}).filter(([name]) => activeTools.includes(name as keyof TOOLS))
      : Object.entries(tools || {});

  // Provider tool type differs between versions:
  // - V2 (AI SDK v5): 'provider-defined'
  // - V3 (AI SDK v6): 'provider'
  const providerToolType = targetVersion === 'v3' ? 'provider' : 'provider-defined';

  return {
    tools: filteredTools
      .map(([name, tool]) => {
        try {
          // Check if this is a provider tool BEFORE calling toolFn
          // V6 provider tools (like openaiV6.tools.webSearch()) have type='function' but
          // contain an 'id' property with format '<provider>.<tool_name>'
          if (isProviderTool(tool)) {
            return {
              type: providerToolType,
              name: getProviderToolName(tool.id),
              id: tool.id,
              args: tool.args ?? {},
            } as PreparedTool;
          }

          let inputSchema;
          if ('inputSchema' in tool) {
            inputSchema = tool.inputSchema;
          } else if ('parameters' in tool) {
            // @ts-ignore tool is not part
            inputSchema = tool.parameters;
          }

          const sdkTool = toolFn({
            type: 'function',
            ...tool,
            inputSchema,
          } as any);

          const toolType = sdkTool?.type ?? 'function';

          switch (toolType) {
            case undefined:
            case 'dynamic':
            case 'function':
              return {
                type: 'function' as const,
                name,
                description: sdkTool.description,
                inputSchema: asSchema(sdkTool.inputSchema).jsonSchema,
                providerOptions: sdkTool.providerOptions,
              };
            case 'provider-defined': {
              // Fallback for tools that pass through toolFn and still get recognized as provider-defined
              const providerId = (sdkTool as any).id;
              return {
                type: providerToolType,
                name: providerId ? getProviderToolName(providerId) : name,
                id: providerId,
                args: (sdkTool as any).args,
              } as PreparedTool;
            }
            default: {
              const exhaustiveCheck: never = toolType;
              throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
            }
          }
        } catch (e) {
          console.error('Error preparing tool', e);
          return null;
        }
      })
      .filter((tool): tool is PreparedTool => tool !== null),
    toolChoice:
      toolChoice == null
        ? { type: 'auto' }
        : typeof toolChoice === 'string'
          ? { type: toolChoice }
          : { type: 'tool' as const, toolName: toolChoice.toolName as string },
  };
}

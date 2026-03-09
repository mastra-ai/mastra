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
import { getProviderToolName, isProviderDefinedTool } from '../../../../tools/toolchecks';

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
 * Recursively fixes JSON Schema properties that lack a 'type' key.
 * Zod v4's toJSONSchema serializes z.any() to just { description: "..." } with no 'type',
 * which providers like OpenAI reject. This converts such schemas to a permissive type union.
 */
function fixTypelessProperties(schema: Record<string, unknown>): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) return schema;

  const result = { ...schema };

  if (result.properties && typeof result.properties === 'object' && !Array.isArray(result.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties as Record<string, unknown>).map(([key, value]) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return [key, value];
        }
        const propSchema = value as Record<string, unknown>;
        const hasType = 'type' in propSchema;
        const hasRef = '$ref' in propSchema;
        const hasAnyOf = 'anyOf' in propSchema;
        const hasOneOf = 'oneOf' in propSchema;
        const hasAllOf = 'allOf' in propSchema;

        if (!hasType && !hasRef && !hasAnyOf && !hasOneOf && !hasAllOf) {
          // Exclude 'array' from the fallback: an array without a meaningful items schema
          // is unusable by the LLM, and including it with items: {} causes Gemini to reject
          // the schema (items is only valid when type is exclusively ARRAY).
          const { items: _items, ...rest } = propSchema;
          return [key, { ...rest, type: ['string', 'number', 'integer', 'boolean', 'object', 'null'] }];
        }
        // Recurse into nested object schemas
        return [key, fixTypelessProperties(propSchema)];
      }),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = (result.items as Record<string, unknown>[]).map(item => fixTypelessProperties(item));
    } else if (typeof result.items === 'object') {
      result.items = fixTypelessProperties(result.items as Record<string, unknown>);
    }
  }

  return result;
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
    // Preserve explicit 'none' toolChoice to tell the LLM not to attempt tool calls
    return {
      tools: undefined,
      toolChoice: toolChoice === 'none' ? { type: 'none' as const } : undefined,
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
          if (isProviderDefinedTool(tool)) {
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
            // @ts-expect-error tool is not part
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
                inputSchema: fixTypelessProperties(asSchema(sdkTool.inputSchema).jsonSchema as Record<string, unknown>),
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

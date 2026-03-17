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
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../../../schema';
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

const PERMISSIVE_TYPE = ['string', 'number', 'integer', 'boolean', 'object', 'null'];

function isTypelessSchema(s: Record<string, unknown>): boolean {
  return !('type' in s) && !('$ref' in s) && !('anyOf' in s) && !('oneOf' in s) && !('allOf' in s);
}

/**
 * Recursively fixes JSON Schema nodes that lack a 'type' key.
 * z.any() serializes to { description: "..." } with no 'type', which providers like OpenAI reject.
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
        if (isTypelessSchema(propSchema)) {
          const { items: _items, ...rest } = propSchema;
          return [key, { ...rest, type: PERMISSIVE_TYPE }];
        }
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

  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(result[keyword])) {
      result[keyword] = (result[keyword] as Record<string, unknown>[]).map(branch => {
        if (typeof branch !== 'object' || branch === null || Array.isArray(branch)) return branch;
        const b = branch as Record<string, unknown>;
        if (isTypelessSchema(b)) {
          const { items: _items, ...rest } = b;
          return { ...rest, type: PERMISSIVE_TYPE };
        }
        return fixTypelessProperties(b);
      });
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
  if (toolChoice === 'none') {
    // When toolChoice is 'none', strip tools entirely — providers like Gemini reject
    // requests that combine tools + structured output (response_format: json_schema)
    return {
      tools: undefined,
      toolChoice: { type: 'none' as const },
    };
  }

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
              // Convert tool input schema to JSON Schema
              let parameters;
              if (sdkTool.inputSchema) {
                if (
                  '$schema' in sdkTool.inputSchema &&
                  typeof sdkTool.inputSchema.$schema === 'string' &&
                  sdkTool.inputSchema.$schema.startsWith('http://json-schema.org/')
                ) {
                  parameters = sdkTool.inputSchema;
                } else if (isStandardSchemaWithJSON(sdkTool.inputSchema)) {
                  parameters = standardSchemaToJSONSchema(sdkTool.inputSchema, {
                    io: 'input',
                    target: 'draft-07',
                  });
                } else {
                  // Fallback to AI SDK's asSchema for non-standard schemas
                  parameters = asSchema(sdkTool.inputSchema).jsonSchema;
                }

                // Normalize $schema field to draft-07 for consistency
                // Some tools (created with tool() helper) use Zod v4's native generation
                // which defaults to draft 2020-12, but we want draft-07 for LLM compatibility
                if (
                  parameters &&
                  typeof parameters === 'object' &&
                  '$schema' in parameters &&
                  parameters.$schema !== 'http://json-schema.org/draft-07/schema#'
                ) {
                  parameters.$schema = 'http://json-schema.org/draft-07/schema#';
                }
              } else {
                // No schema provided - use empty object
                parameters = {
                  type: 'object',
                  properties: {},
                  additionalProperties: false,
                };
              }

              return {
                type: 'function' as const,
                name,
                description: sdkTool.description,
                inputSchema: fixTypelessProperties(parameters as Record<string, unknown>),
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

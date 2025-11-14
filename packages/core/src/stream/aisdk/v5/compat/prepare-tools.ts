import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2ToolChoice,
} from '@ai-sdk/provider-v5';
import { asSchema, tool as toolFn } from 'ai-v5';
import type { Tool, ToolChoice } from 'ai-v5';

export function prepareToolsAndToolChoice<TOOLS extends Record<string, Tool>>({
  tools,
  toolChoice,
  activeTools,
}: {
  tools: TOOLS | undefined;
  toolChoice: ToolChoice<TOOLS> | undefined;
  activeTools: Array<keyof TOOLS> | undefined;
}): {
  tools: Array<LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool> | undefined;
  toolChoice: LanguageModelV2ToolChoice | undefined;
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

  return {
    tools: filteredTools
      .map(([name, tool]) => {
        try {
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
            case 'provider-defined':
              return {
                type: 'provider-defined' as const,
                name,
                // TODO: as any seems wrong here. are there cases where we don't have an id?
                id: (sdkTool as any).id,
                args: (sdkTool as any).args,
              };
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
      .filter(tool => tool !== null) as (LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool)[],
    toolChoice:
      toolChoice == null
        ? { type: 'auto' }
        : typeof toolChoice === 'string'
          ? { type: toolChoice }
          : { type: 'tool' as const, toolName: toolChoice.toolName as string },
  };
}

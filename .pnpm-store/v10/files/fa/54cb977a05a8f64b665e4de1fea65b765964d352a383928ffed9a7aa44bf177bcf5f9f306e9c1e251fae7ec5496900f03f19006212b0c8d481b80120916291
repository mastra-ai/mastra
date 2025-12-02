import type { LanguageModelV2FunctionTool, LanguageModelV2ProviderDefinedTool, LanguageModelV2ToolChoice } from '@ai-sdk/provider-v5';
import type { Tool, ToolChoice } from 'ai-v5';
export declare function prepareToolsAndToolChoice<TOOLS extends Record<string, Tool>>({ tools, toolChoice, activeTools, }: {
    tools: TOOLS | undefined;
    toolChoice: ToolChoice<TOOLS> | undefined;
    activeTools: Array<keyof TOOLS> | undefined;
}): {
    tools: Array<LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool> | undefined;
    toolChoice: LanguageModelV2ToolChoice | undefined;
};
//# sourceMappingURL=prepare-tools.d.ts.map
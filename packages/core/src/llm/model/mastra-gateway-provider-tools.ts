import type { LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { WebSearchProviderToolId } from '../../tools/builtin/web-search';

const OPENROUTER_WEB_SEARCH_TOOL_ID = 'openrouter.web_search';

// Keyed by the union so a new webSearchTool provider fails to compile until it is listed here.
const NATIVE_WEB_SEARCH_TOOL_IDS: Record<WebSearchProviderToolId, true> = {
  'openai.web_search': true,
  'anthropic.web_search_20250305': true,
  'google.google_search': true,
  'xai.web_search': true,
};

/** True for the gateway's OpenRouter chat models, false for its native Anthropic OAuth models. */
export function isOpenRouterModel(model: { provider?: unknown }): boolean {
  return (
    typeof model.provider === 'string' && (model.provider === 'openrouter' || model.provider.startsWith('openrouter.'))
  );
}

/**
 * The Mastra gateway's chat endpoint only runs `openrouter:*` server tools. Another provider's
 * native tool is rejected with a 400 (OpenAI, xAI models) or dropped without an error (Anthropic,
 * Google models), so the model silently loses the tool.
 *
 * A native web search tool with no arguments is swapped for the gateway's web search, which works
 * for every tool-calling model. Any other native tool fails here with an actionable message.
 */
export function prepareToolsForMastraGateway(
  options: LanguageModelV2CallOptions,
  routerId: string,
): LanguageModelV2CallOptions {
  // Tools normally arrive as `provider-defined`; `provider` is the AI SDK 6 spelling of the same tool.
  const isProviderTool = (tool: { type: string }) => tool.type === 'provider-defined' || tool.type === 'provider';

  if (!options.tools?.some(isProviderTool)) {
    return options;
  }

  const tools = options.tools.map(tool => {
    if (!isProviderTool(tool)) {
      return tool;
    }
    const { id, args } = tool as { id: string; args?: Record<string, unknown> };
    if (id.startsWith('openrouter.')) {
      return tool;
    }

    const isWebSearch = id in NATIVE_WEB_SEARCH_TOOL_IDS;
    if (isWebSearch && Object.keys(args ?? {}).length === 0) {
      return { ...tool, id: OPENROUTER_WEB_SEARCH_TOOL_ID };
    }

    throw new MastraError({
      id: 'MASTRA_GATEWAY_UNSUPPORTED_PROVIDER_TOOL',
      domain: ErrorDomain.LLM,
      category: ErrorCategory.USER,
      details: { toolId: id, model: routerId },
      text:
        `The provider tool "${id}" cannot be used with "${routerId}". The Mastra gateway only runs its own server tools. ` +
        (isWebSearch
          ? `Its web search does not accept "${id}" options: use webSearchTool from @mastra/core/tools, or call the provider directly to keep them.`
          : `Call the provider directly to use this tool.`),
    });
  });

  return { ...options, tools: tools as LanguageModelV2CallOptions['tools'] };
}

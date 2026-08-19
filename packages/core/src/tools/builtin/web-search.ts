import type { ProviderDefinedTool } from '@internal/external-types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';

const WEB_SEARCH_TOOL_MARKER = Symbol.for('mastra.tools.webSearchTool');

export type WebSearchProvider = 'openai' | 'anthropic' | 'google' | 'xai';
export type WebSearchProviderToolId =
  | 'openai.web_search'
  | 'anthropic.web_search_20250305'
  | 'google.google_search'
  | 'xai.web_search';

export type WebSearchToolPlaceholder = {
  readonly [WEB_SEARCH_TOOL_MARKER]: true;
};

export const webSearchTool: WebSearchToolPlaceholder = Object.freeze({
  [WEB_SEARCH_TOOL_MARKER]: true,
});

export function isWebSearchTool(tool: unknown): tool is WebSearchToolPlaceholder {
  return (
    tool === webSearchTool ||
    (typeof tool === 'object' && tool !== null && (tool as WebSearchToolPlaceholder)[WEB_SEARCH_TOOL_MARKER] === true)
  );
}

export function normalizeWebSearchProvider(providerOrModel: unknown): WebSearchProvider {
  const provider = getProviderString(providerOrModel);
  const supportedProviders = new Set<WebSearchProvider>(['openai', 'anthropic', 'google', 'xai']);

  if (supportedProviders.has(provider as WebSearchProvider)) {
    return provider as WebSearchProvider;
  }

  const routerProvider = getRouterProvider(provider);
  if (supportedProviders.has(routerProvider as WebSearchProvider)) {
    return routerProvider as WebSearchProvider;
  }

  throw new MastraError({
    id: 'WEB_SEARCH_UNSUPPORTED_PROVIDER',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    details: {
      provider,
    },
    text: `The built-in webSearchTool supports OpenAI, Anthropic, Google, and xAI models. Could not infer a supported provider from "${provider}".`,
  });
}

export function createWebSearchProviderTool(provider: WebSearchProvider): ProviderDefinedTool {
  const tool = getWebSearchProviderTool(provider);
  return {
    type: 'provider-defined',
    id: tool.id,
    name: tool.name,
    args: {},
  } as ProviderDefinedTool;
}

function getProviderString(providerOrModel: unknown): string {
  if (typeof providerOrModel === 'string') {
    return providerOrModel;
  }

  if (typeof providerOrModel === 'object' && providerOrModel !== null) {
    const model = providerOrModel as { provider?: unknown; modelId?: unknown; id?: unknown };
    if (typeof model.provider === 'string') {
      if (model.provider === 'openai-compatible') {
        if (typeof model.modelId === 'string') {
          return model.modelId;
        }

        if (typeof model.id === 'string') {
          return model.id;
        }
      }

      return model.provider;
    }

    if (typeof model.modelId === 'string') {
      return model.modelId;
    }

    if (typeof model.id === 'string') {
      return model.id;
    }
  }

  return String(providerOrModel);
}

function getRouterProvider(provider: string): string {
  const slashIndex = provider.indexOf('/');
  return slashIndex > 0 ? provider.slice(0, slashIndex) : provider;
}

function getWebSearchProviderTool(provider: WebSearchProvider): { id: WebSearchProviderToolId; name: string } {
  switch (provider) {
    case 'openai':
      return { id: 'openai.web_search', name: 'web_search' };
    case 'anthropic':
      return { id: 'anthropic.web_search_20250305', name: 'web_search' };
    case 'google':
      return { id: 'google.google_search', name: 'google_search' };
    case 'xai':
      return { id: 'xai.web_search', name: 'web_search' };
  }
}

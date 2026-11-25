/**
 * Requests to custom OpenAI-compatible endpoints: the headers they carry, the
 * chat model a session uses, and the checks that call an endpoint before or
 * after it is saved.
 *
 * `mastracode-gateway.ts` imports this module, so this module must never import
 * the gateway.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { customProviderAuthHeaderName, mergeHeadersIgnoringCase } from '../onboarding/custom-provider-headers.js';
import type { CustomProviderAuthScheme, CustomProviderHeader } from '../onboarding/settings.js';

export { customProviderHeaderProblem } from '../onboarding/custom-provider-headers.js';

/** The language model `createCustomProviderChatModel` returns. */
export type CustomProviderChatModel = ReturnType<OpenAICompatibleProvider['chatModel']>;

/** Everything needed to call a custom endpoint, with saved secrets already resolved. */
export interface CustomProviderConnection {
  url: string;
  apiKey?: string;
  authScheme?: CustomProviderAuthScheme;
  headers?: CustomProviderHeader[];
}

/**
 * `fetch` that refuses redirects. Servers call custom endpoints too, and a
 * redirect could aim that call at an address the saved URL never named.
 */
export const fetchWithoutRedirects: typeof fetch = (input, init) => fetch(input, { ...init, redirect: 'error' });

/**
 * The custom headers of a connection plus the header that carries its key.
 * The auth header comes last so that nothing can replace it.
 */
export function customProviderRequestHeaders(connection: CustomProviderConnection): Record<string, string> {
  const custom = Object.fromEntries((connection.headers ?? []).map(header => [header.name, header.value]));
  const apiKey = connection.apiKey?.trim();
  if (!apiKey) return mergeHeadersIgnoringCase(custom);
  const authValue = connection.authScheme === 'x-api-key' ? apiKey : `Bearer ${apiKey}`;
  return mergeHeadersIgnoringCase(custom, { [customProviderAuthHeaderName(connection.authScheme)]: authValue });
}

/**
 * The chat model a session uses for a custom endpoint. `requestHeaders` are
 * Mastra's own per-request headers (`x-thread-id`, `x-resource-id`). A custom
 * header may replace them, and nothing replaces the auth header.
 */
export function createCustomProviderChatModel(args: {
  providerId: string;
  connection: CustomProviderConnection;
  modelId: string;
  requestHeaders?: Record<string, string>;
}): CustomProviderChatModel {
  // The key never goes in `apiKey`: the AI SDK writes that header first, where
  // a custom header of the same name would replace it.
  const provider = createOpenAICompatible({
    name: args.providerId,
    baseURL: args.connection.url,
    headers: mergeHeadersIgnoringCase(args.requestHeaders, customProviderRequestHeaders(args.connection)),
    fetch: fetchWithoutRedirects,
  });
  return provider.chatModel(args.modelId);
}

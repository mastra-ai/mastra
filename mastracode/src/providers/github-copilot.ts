/**
 * GitHub Copilot OAuth Provider
 *
 * Uses OAuth tokens from AuthStorage to authenticate with GitHub Copilot's chat API.
 * The Copilot API speaks OpenAI's Chat Completions / Responses format, so we plug
 * `@ai-sdk/openai` into a custom fetch that injects the bearer token and Copilot-specific
 * headers and rewrites the base URL based on the `proxy-ep` claim in the token.
 *
 * Inspired by:
 *   - opencode: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/github-copilot/copilot.ts
 *   - pi-mono:  https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/github-copilot.ts
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { MastraModelConfig } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { COPILOT_HEADERS, fetchCopilotModels, getGitHubCopilotBaseUrl } from '../auth/providers/github-copilot.js';
import type { CopilotModelEntry, GitHubCopilotCredentials } from '../auth/providers/github-copilot.js';
import { AuthStorage } from '../auth/storage.js';

const COPILOT_PROVIDER_ID = 'github-copilot';

// Singleton auth storage instance (shared with claude-max.ts / openai-codex.ts when not overridden).
let authStorageInstance: AuthStorage | null = null;

/** Get or create the shared AuthStorage instance. */
export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    authStorageInstance = new AuthStorage();
  }
  return authStorageInstance;
}

/** Set a custom AuthStorage instance (useful for tests / TUI integration). */
export function setAuthStorage(storage: AuthStorage | undefined): void {
  authStorageInstance = storage ?? null;
}

/**
 * Heuristic: did this request come from the agent (e.g. tool result follow-ups) rather
 * than a fresh user turn? Mirrors opencode's `isAgent` logic — Copilot bills these
 * differently via the `x-initiator` header.
 */
function detectIsAgent(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;

  const messages = obj.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const last = messages[messages.length - 1] as { role?: string; content?: unknown };
    if (last?.role && last.role !== 'user') return true;
    if (Array.isArray(last?.content)) {
      // If the last user turn carries any tool_result parts, treat it as an agent turn.
      const hasToolResult = last.content.some(
        (part: unknown) => part && typeof part === 'object' && (part as { type?: string }).type === 'tool_result',
      );
      if (hasToolResult) return true;
    }
  }

  const input = obj.input;
  if (Array.isArray(input) && input.length > 0) {
    const last = input[input.length - 1] as { role?: string };
    if (last?.role && last.role !== 'user') return true;
  }

  return false;
}

/** Detect image/vision content in a request body. */
function detectIsVision(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;

  const matchPart = (part: unknown): boolean => {
    if (!part || typeof part !== 'object') return false;
    const t = (part as { type?: string }).type;
    return t === 'image' || t === 'image_url' || t === 'input_image';
  };

  const messages = obj.messages;
  if (Array.isArray(messages)) {
    return messages.some(
      (msg: unknown) =>
        msg &&
        typeof msg === 'object' &&
        Array.isArray((msg as { content?: unknown }).content) &&
        ((msg as { content: unknown[] }).content as unknown[]).some(matchPart),
    );
  }

  const input = obj.input;
  if (Array.isArray(input)) {
    return input.some(
      (item: unknown) =>
        item &&
        typeof item === 'object' &&
        Array.isArray((item as { content?: unknown }).content) &&
        ((item as { content: unknown[] }).content as unknown[]).some(matchPart),
    );
  }

  return false;
}

/**
 * Build a fetch wrapper that authenticates with GitHub Copilot OAuth.
 *
 * - Injects the short-lived Copilot bearer token (auto-refreshed by AuthStorage).
 * - Adds the VS Code-like Copilot headers required by the API.
 * - Rewrites the request URL onto the per-token API base when `rewriteUrl` is true.
 */
export function buildGitHubCopilotOAuthFetch(
  opts: { authStorage?: AuthStorage; rewriteUrl?: boolean } = {},
): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const storage = opts.authStorage ?? getAuthStorage();
    storage.reload();

    const cred = storage.get(COPILOT_PROVIDER_ID);
    if (!cred || cred.type !== 'oauth') {
      throw new Error('Not logged in to GitHub Copilot. Run /login first.');
    }

    // getApiKey() refreshes the Copilot bearer if it has expired.
    const accessToken = await storage.getApiKey(COPILOT_PROVIDER_ID);
    if (!accessToken) {
      throw new Error('Failed to refresh GitHub Copilot token. Please /login again.');
    }
    storage.reload();

    const enterpriseUrl = (cred as GitHubCopilotCredentials).enterpriseUrl;

    let parsedBody: unknown;
    if (typeof init?.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = undefined;
      }
    }
    const isAgent = detectIsAgent(parsedBody);
    const isVision = detectIsVision(parsedBody);

    // Preserve non-auth headers from caller.
    const headers = new Headers();
    if (init?.headers) {
      const source =
        init.headers instanceof Headers
          ? init.headers
          : Array.isArray(init.headers)
            ? new Headers(init.headers as Array<[string, string]>)
            : new Headers(init.headers as Record<string, string>);
      source.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower !== 'authorization' && lower !== 'x-api-key') {
          headers.set(key, value);
        }
      });
    }

    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('x-initiator', isAgent ? 'agent' : 'user');
    headers.set('Openai-Intent', 'conversation-edits');
    if (isVision) {
      headers.set('Copilot-Vision-Request', 'true');
    }
    for (const [key, value] of Object.entries(COPILOT_HEADERS)) {
      // Only set if caller didn't already provide it (allow overrides for tests).
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }

    const finalUrl =
      opts.rewriteUrl !== false
        ? rewriteToCopilotBase(url, accessToken, enterpriseUrl)
        : url instanceof URL
          ? url
          : typeof url === 'string'
            ? new URL(url)
            : new URL((url as Request).url);

    try {
      return await fetch(finalUrl, { ...init, headers });
    } catch (error) {
      if (error && typeof error === 'object') {
        Object.assign(error as Record<string, unknown>, {
          requestUrl: finalUrl.toString(),
        });
      }
      throw error;
    }
  }) as typeof fetch;
}

function rewriteToCopilotBase(url: string | URL | Request, token: string, enterpriseDomain?: string): URL {
  const original = url instanceof URL ? url : new URL(typeof url === 'string' ? url : (url as Request).url);
  const base = new URL(getGitHubCopilotBaseUrl(token, enterpriseDomain));
  // Preserve the path/search of the original request, anchored at the Copilot base.
  return new URL(`${original.pathname}${original.search}`, base);
}

/**
 * Middleware that prevents the @ai-sdk/openai provider from sending parameters that
 * Copilot's OpenAI-compatible endpoint rejects. Copilot ignores `topP` when temperature
 * is set, and it also treats `store` as required-false on the Responses API.
 */
const copilotMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    if (params.temperature !== undefined && params.temperature !== null) {
      delete params.topP;
    }
    return params;
  },
};

/**
 * Creates a model that talks to GitHub Copilot using OAuth credentials.
 *
 * Copilot's `/chat/completions` endpoint is compatible with OpenAI's chat-completions
 * API, so we wire `@ai-sdk/openai` to it via {@link buildGitHubCopilotOAuthFetch}.
 */
export function githubCopilotProvider(
  modelId: string = 'claude-sonnet-4.5',
  options?: { headers?: Record<string, string> },
): MastraModelConfig {
  const headers = options?.headers;

  // Test environment: avoid touching real auth storage.
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const openai = createOpenAI({
      apiKey: 'test-api-key',
      headers,
    });
    return wrapLanguageModel({
      model: openai.chat(modelId),
      middleware: [copilotMiddleware],
    });
  }

  const openai = createOpenAI({
    // Real auth comes from the custom fetch; the SDK still requires *some* apiKey.
    apiKey: 'oauth-placeholder',
    headers,
    fetch: buildGitHubCopilotOAuthFetch() as any,
  });

  return wrapLanguageModel({
    model: openai.chat(modelId),
    middleware: [copilotMiddleware],
  });
}

// ---------------------------------------------------------------------------
// Live model catalog
// ---------------------------------------------------------------------------

/**
 * Hard-coded fallback advertised when the live `/models` request fails (network
 * down, expired token, etc.). Both are widely available across paid Copilot
 * tiers, so the user can still pick a model without a live API call.
 */
const COPILOT_FALLBACK_MODELS: CopilotModelEntry[] = [
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    vendor: 'Anthropic',
    isAnthropicShaped: false,
    supportsVision: true,
    supportsToolCalls: true,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    vendor: 'OpenAI',
    isAnthropicShaped: false,
    supportsVision: true,
    supportsToolCalls: true,
  },
];

const CATALOG_TTL_MS = 10 * 60 * 1000;
const CATALOG_FAILURE_TTL_MS = 60 * 1000;
const CATALOG_FETCH_TIMEOUT_MS = 5_000;

interface CatalogCacheEntry {
  fetchedAt: number;
  ttl: number;
  models: CopilotModelEntry[];
}

let catalogCache: CatalogCacheEntry | null = null;
let inflightFetch: Promise<CopilotModelEntry[]> | null = null;

/** Reset the in-process Copilot catalog cache (test seam, also useful after logout). */
export function clearCopilotCatalogCache(): void {
  catalogCache = null;
  inflightFetch = null;
}

/**
 * Return the user's currently-available Copilot models.
 *
 * - Returns `[]` when the user is not logged in to GitHub Copilot.
 * - Returns the cached list when a recent fetch succeeded.
 * - On the cache-miss / expired path, fetches `/models` with a 5s timeout, filters
 *   to picker-enabled and non-policy-disabled models, then caches for 10 minutes.
 * - On fetch failure, returns a small hard-coded fallback (so packs still work
 *   offline) and caches that for 1 minute to avoid hammering the API.
 *
 * Concurrent calls during a fetch share the inflight promise.
 */
export async function getCopilotModelCatalog(opts: { authStorage?: AuthStorage } = {}): Promise<CopilotModelEntry[]> {
  const storage = opts.authStorage ?? getAuthStorage();
  storage.reload();

  const cred = storage.get(COPILOT_PROVIDER_ID);
  if (!cred || cred.type !== 'oauth') {
    return [];
  }

  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < catalogCache.ttl) {
    return catalogCache.models;
  }

  if (inflightFetch) return inflightFetch;

  inflightFetch = (async (): Promise<CopilotModelEntry[]> => {
    try {
      // getApiKey() refreshes the Copilot bearer if it has expired.
      const accessToken = await storage.getApiKey(COPILOT_PROVIDER_ID);
      if (!accessToken) throw new Error('No Copilot bearer token');
      storage.reload();

      const refreshed = storage.get(COPILOT_PROVIDER_ID);
      const enterpriseUrl = (refreshed as GitHubCopilotCredentials | undefined)?.enterpriseUrl;
      const baseUrl = getGitHubCopilotBaseUrl(accessToken, enterpriseUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CATALOG_FETCH_TIMEOUT_MS);
      try {
        const models = await fetchCopilotModels({
          baseUrl,
          bearerToken: accessToken,
          signal: controller.signal,
        });
        catalogCache = { fetchedAt: Date.now(), ttl: CATALOG_TTL_MS, models };
        return models;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      catalogCache = {
        fetchedAt: Date.now(),
        ttl: CATALOG_FAILURE_TTL_MS,
        models: COPILOT_FALLBACK_MODELS,
      };
      console.warn(
        'Failed to fetch live GitHub Copilot models, using fallback list:',
        error instanceof Error ? error.message : error,
      );
      return COPILOT_FALLBACK_MODELS;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

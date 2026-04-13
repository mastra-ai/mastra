/**
 * OpenAI Codex OAuth Provider
 *
 * Uses OAuth tokens from AuthStorage to authenticate with ChatGPT Plus/Pro subscription.
 * This allows access to OpenAI models through the ChatGPT OAuth flow.
 *
 * Inspired by opencode's Codex plugin implementation:
 * https://github.com/sst/opencode/blob/main/packages/opencode/src/plugin/codex.ts
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { MastraModelConfig } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { AuthStorage } from '../auth/storage.js';

// Codex API endpoint (not standard OpenAI API)
const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';

// Singleton auth storage instance (shared with claude-max.ts)
let authStorageInstance: AuthStorage | null = null;

/**
 * Get or create the shared AuthStorage instance
 */
export function getAuthStorage(): AuthStorage {
  if (!authStorageInstance) {
    authStorageInstance = new AuthStorage();
  }
  return authStorageInstance;
}

/**
 * Set a custom AuthStorage instance (useful for TUI integration)
 */
export function setAuthStorage(storage: AuthStorage | undefined): void {
  authStorageInstance = storage ?? null;
}

// Default instructions for Codex API (required)
const CODEX_INSTRUCTIONS = `You are an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: You should be concise, direct, and helpful. Focus on solving the user's problem efficiently.`;

/** Valid thinking level values. */
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh';

const GPT5_MODEL_RE = /^gpt-5(?:\.|-|$)/;

export function getEffectiveThinkingLevel(modelId: string, level: ThinkingLevel): ThinkingLevel {
  // GPT-5.* models on Codex require at least low reasoning.
  if (GPT5_MODEL_RE.test(modelId) && level === 'off') {
    return 'low';
  }

  return level;
}

// Map thinkingLevel state values to OpenAI reasoningEffort values.
// undefined means omit the parameter (no reasoning).
export const THINKING_LEVEL_TO_REASONING_EFFORT: Record<ThinkingLevel, string | undefined> = {
  off: undefined,
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
};

/**
 * Create Codex middleware with the given reasoning effort level.
 */
export function createCodexMiddleware(reasoningEffort?: string): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      // Remove topP if temperature is set (OpenAI doesn't like both)
      if (params.temperature !== undefined && params.temperature !== null) {
        delete params.topP;
      }

      // Codex API requires specific settings via providerOptions
      // Use type assertion to satisfy JSONValue constraints
      params.providerOptions = {
        ...params.providerOptions,
        openai: {
          ...(params.providerOptions?.openai ?? {}),
          instructions: CODEX_INSTRUCTIONS,
          // Codex API requires store to be false
          store: false,
          // Enable reasoning for Codex models — without this, the model
          // skips the reasoning/action phase and goes straight to final_answer,
          // resulting in narration instead of tool calls.
          ...(reasoningEffort ? { reasoningEffort } : {}),
        },
      } as typeof params.providerOptions;

      return params;
    },
  };
}

/**
 * Build a fetch function that handles OpenAI Codex OAuth.
 * Preserves non-authorization headers from init.
 * When rewriteUrl is true (default), rewrites /v1/responses and /chat/completions
 * to the Codex API endpoint. Set rewriteUrl: false for gateway usage where the
 * SDK already targets the correct URL.
 */
export function buildOpenAICodexOAuthFetch(
  opts: { authStorage?: AuthStorage; rewriteUrl?: boolean } = {},
): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const storage = opts.authStorage ?? getAuthStorage();
    storage.reload();

    const cred = storage.get('openai-codex');
    if (!cred || cred.type !== 'oauth') {
      throw new Error('Not logged in to OpenAI Codex. Run /login first.');
    }

    let accessToken = cred.access;
    if (Date.now() >= cred.expires) {
      const refreshedToken = await storage.getApiKey('openai-codex');
      if (!refreshedToken) {
        throw new Error('Failed to refresh OpenAI Codex token. Please /login again.');
      }
      accessToken = refreshedToken;
      storage.reload();
    }

    const accountId = (cred as any).accountId as string | undefined;

    // Preserve non-authorization headers
    const headers = new Headers();
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'authorization') {
            headers.set(key, value);
          }
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          if (key!.toLowerCase() !== 'authorization' && value !== undefined) {
            headers.set(key!, String(value));
          }
        }
      } else {
        for (const [key, value] of Object.entries(init.headers)) {
          if (key.toLowerCase() !== 'authorization' && value !== undefined) {
            headers.set(key, String(value));
          }
        }
      }
    }

    headers.set('Authorization', `Bearer ${accessToken}`);
    if (accountId) {
      headers.set('ChatGPT-Account-Id', accountId);
    }

    // URL rewriting — only when rewriteUrl !== false
    const parsed = url instanceof URL ? url : new URL(typeof url === 'string' ? url : (url as Request).url);
    const shouldRewrite =
      opts.rewriteUrl !== false &&
      (parsed.pathname.includes('/v1/responses') || parsed.pathname.includes('/chat/completions'));
    const finalUrl = shouldRewrite ? new URL(CODEX_API_ENDPOINT) : parsed;

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

/**
 * Creates an OpenAI model using ChatGPT OAuth authentication
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed)
 *
 * IMPORTANT: This uses the Codex API endpoint, not the standard OpenAI API.
 * URLs are rewritten from /v1/responses or /chat/completions to the Codex endpoint.
 */
export function openaiCodexProvider(
  modelId: string = 'codex-mini-latest',
  options?: { thinkingLevel?: ThinkingLevel; headers?: Record<string, string> },
): MastraModelConfig {
  const requestedLevel: ThinkingLevel = options?.thinkingLevel ?? 'medium';
  const effectiveLevel = getEffectiveThinkingLevel(modelId, requestedLevel);
  const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
  const middleware = createCodexMiddleware(reasoningEffort);
  const headers = options?.headers;

  // Test environment: use API key
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const openai = createOpenAI({
      apiKey: 'test-api-key',
      headers,
    });
    return wrapLanguageModel({
      model: openai.responses(modelId),
      middleware: [middleware],
    });
  }

  const openai = createOpenAI({
    apiKey: 'oauth-dummy-key',
    headers,
    fetch: buildOpenAICodexOAuthFetch() as any,
  });

  // Use the responses API for Codex models
  // Wrap with middleware
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: [middleware],
  });
}

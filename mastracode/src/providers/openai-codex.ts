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
export function setAuthStorage(storage: AuthStorage): void {
  authStorageInstance = storage;
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
const THINKING_LEVEL_TO_REASONING_EFFORT: Record<ThinkingLevel, string | undefined> = {
  off: undefined,
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
};

/**
 * Create Codex middleware with the given reasoning effort level.
 */
function createCodexMiddleware(reasoningEffort?: string): LanguageModelMiddleware {
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
 * Creates an OpenAI model using ChatGPT OAuth authentication
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed)
 *
 * IMPORTANT: This uses the Codex API endpoint, not the standard OpenAI API.
 * URLs are rewritten from /v1/responses or /chat/completions to the Codex endpoint.
 */
export function openaiCodexProvider(
  modelId: string = 'codex-mini-latest',
  options?: { thinkingLevel?: ThinkingLevel },
): MastraModelConfig {
  // Map thinkingLevel to OpenAI reasoningEffort, defaulting to 'medium'.
  // When level is 'off', reasoningEffort is undefined and the parameter is omitted.
  // GPT-5.* models are floored to at least "low" on Codex.
  const requestedLevel: ThinkingLevel = options?.thinkingLevel ?? 'medium';
  const effectiveLevel = getEffectiveThinkingLevel(modelId, requestedLevel);
  const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
  const middleware = createCodexMiddleware(reasoningEffort);

  // Test environment: use API key
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-api-key',
    });
    return wrapLanguageModel({
      model: openai.responses(modelId),
      middleware: [middleware],
    });
  }

  // Custom fetch that handles OAuth and URL rewriting
  const oauthFetch = async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const authStorage = getAuthStorage();

    // Reload from disk to handle multi-instance refresh
    authStorage.reload();

    // Get credentials (includes accountId)
    const cred = authStorage.get('openai-codex');

    if (!cred || cred.type !== 'oauth') {
      throw new Error('Not logged in to OpenAI Codex. Run /login first.');
    }

    // Check if token needs refresh
    let accessToken = cred.access;
    if (Date.now() >= cred.expires) {
      // Token expired, need to refresh via getApiKey which handles refresh
      const refreshedToken = await authStorage.getApiKey('openai-codex');
      if (!refreshedToken) {
        throw new Error('Failed to refresh OpenAI Codex token. Please /login again.');
      }
      accessToken = refreshedToken;
      // Reload to get updated accountId
      authStorage.reload();
    }

    // Get accountId from credentials
    const accountId = (cred as any).accountId as string | undefined;

    // Build headers - remove any existing authorization header first
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

    // Set authorization header with access token
    headers.set('Authorization', `Bearer ${accessToken}`);

    // Set ChatGPT-Account-Id header for organization subscriptions
    if (accountId) {
      headers.set('ChatGPT-Account-Id', accountId);
    }

    // Rewrite URL to Codex endpoint if it's a chat/responses request
    const parsed = url instanceof URL ? url : new URL(typeof url === 'string' ? url : (url as Request).url);

    const shouldRewrite = parsed.pathname.includes('/v1/responses') || parsed.pathname.includes('/chat/completions');
    const finalUrl = shouldRewrite ? new URL(CODEX_API_ENDPOINT) : parsed;

    return fetch(finalUrl, {
      ...init,
      headers,
    });
  };

  const openai = createOpenAI({
    // Use a dummy API key since we're using OAuth
    apiKey: 'oauth-dummy-key',
    fetch: oauthFetch as any,
  });

  // Use the responses API for Codex models
  // Wrap with middleware
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: [middleware],
  });
}

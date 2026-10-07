/**
 * Claude Max OAuth Provider
 *
 * Uses OAuth tokens from AuthStorage to authenticate with Claude Max plan.
 * The OAuth endpoint requires a specific system message to be present.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { getModelReasoningOptions } from '@mastra/core/llm';
import type { MastraModelConfig } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { ProviderAuthRequiredError } from '../auth/provider-auth-error.js';
import { AuthStorage } from '../auth/storage.js';
import type { CredentialStore } from '../auth/types.js';
import { runThinkingLevel } from '../thinking.js';
import { ANTHROPIC_PROMPT_CACHE_TTL } from './anthropic-prompt-cache.js';
import type { AnthropicPromptCacheScope } from './anthropic-prompt-cache.js';
import { ANTHROPIC_THINKING_BUDGET_TOKENS, getAnthropicThinkingCapability } from './anthropic-thinking.js';
import type { ThinkingLevel } from './openai-codex.js';

// Required for Claude Max plan OAuth - the endpoint checks for this system message
const claudeCodeIdentity = "You are Claude Code, Anthropic's official CLI for Claude.";

// Betas required for Claude Max plan OAuth. Merged with (not replacing) any
// betas the AI SDK already set on the request — e.g. the SDK adds
// `server-side-fallback-2026-06-01` when `providerOptions.anthropic.fallbacks`
// is configured; dropping it makes the API reject the `fallbacks` body field
// with "Extra inputs are not permitted".
const OAUTH_REQUIRED_BETAS = [
  'oauth-2025-04-20',
  'claude-code-20250219',
  'interleaved-thinking-2025-05-14',
  'fine-grained-tool-streaming-2025-05-14',
];

// Singleton auth storage instance
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

/**
 * Middleware that injects the Claude Code identity system message
 * Required for Claude Max OAuth authentication
 */
export const claudeCodeMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    // Prepend the Claude Code identity as the first system message
    const systemMessage = {
      role: 'system' as const,
      content: claudeCodeIdentity,
    };

    if (params.temperature) {
      delete params.topP;
    }

    return {
      ...params,
      prompt: [systemMessage, ...params.prompt],
    };
  },
};

/**
 * Prompt caching middleware for Anthropic
 *
 * Adds cache breakpoints at strategic locations:
 * 1. Last system message (end of static instructions + dynamic memory)
 * 2. Most recent user/assistant message (conversation context), `conversation` scope only
 *
 * This allows Anthropic to cache:
 * - System prompts and instructions (rarely change)
 * - Conversation history up to the last message
 */
export const createPromptCacheMiddleware = (scope: AnthropicPromptCacheScope): LanguageModelMiddleware => ({
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const prompt = [...params.prompt];

    const cacheControl = {
      type: 'ephemeral' as const,
      ttl: scope === 'conversation' ? ANTHROPIC_PROMPT_CACHE_TTL : ('5m' as const),
    };

    // Helper to add cache control to a message's last content part
    const addCacheToMessage = (msg: any) => {
      // For system messages with string content
      if (typeof msg.content === 'string') {
        return {
          ...msg,
          providerOptions: {
            ...msg.providerOptions,
            anthropic: { ...msg.providerOptions?.anthropic, cacheControl },
          },
        };
      }

      // For messages with array content, add to last part
      if (Array.isArray(msg.content) && msg.content.length > 0) {
        const content = [...msg.content];
        const lastPart = content[content.length - 1];
        content[content.length - 1] = {
          ...lastPart,
          providerOptions: {
            ...lastPart.providerOptions,
            anthropic: { ...lastPart.providerOptions?.anthropic, cacheControl },
          },
        };
        return { ...msg, content };
      }

      return msg;
    };

    // Find the last system message index
    let lastSystemIdx = -1;
    for (let i = prompt.length - 1; i >= 0; i--) {
      if ((prompt[i] as any).role === 'system') {
        lastSystemIdx = i;
        break;
      }
    }

    // Add cache breakpoint to last system message
    if (lastSystemIdx >= 0) {
      prompt[lastSystemIdx] = addCacheToMessage(prompt[lastSystemIdx]);
    }

    // Add cache breakpoint to the most recent message (last in array)
    const lastIdx = prompt.length - 1;
    if (scope === 'conversation' && lastIdx >= 0 && lastIdx !== lastSystemIdx) {
      prompt[lastIdx] = addCacheToMessage(prompt[lastIdx]);
    }

    return { ...params, prompt };
  },
});

function runAnthropicRequestLevel(modelId: string, level: ThinkingLevel): ThinkingLevel {
  const routerModelId = `anthropic/${modelId}`;
  return runThinkingLevel(routerModelId, level, getModelReasoningOptions(routerModelId));
}

/**
 * Middleware that maps the session thinking level onto Anthropic extended
 * thinking. Returns `undefined` (no middleware) when the level is `off` or the
 * model doesn't support thinking, preserving the previous request shape.
 *
 * - Adaptive-era models (Sonnet 4.6+/Opus 4.6+): `thinking: adaptive` plus
 *   `output_config.effort`, the closest effort the model accepts.
 * - Budget-era models (Claude 3.7 – Opus 4.5): `thinking: enabled` with a
 *   `budget_tokens` value derived from the level.
 */
export function createAnthropicThinkingMiddleware(
  modelId: string,
  thinkingLevel?: ThinkingLevel,
): LanguageModelMiddleware | undefined {
  if (!thinkingLevel || thinkingLevel === 'off') return undefined;
  const capability = getAnthropicThinkingCapability(modelId);
  if (capability === 'none') return undefined;
  const level = runAnthropicRequestLevel(modelId, thinkingLevel);
  if (level === 'off') return undefined;

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      const anthropicOptions = (params.providerOptions?.anthropic ?? {}) as Record<string, unknown>;
      // Don't override explicit per-request thinking configuration.
      if (anthropicOptions.thinking !== undefined || anthropicOptions.effort !== undefined) {
        return params;
      }

      // Anthropic rejects sampling parameters when thinking is enabled.
      delete params.temperature;
      delete params.topP;
      delete params.topK;

      params.providerOptions = {
        ...params.providerOptions,
        anthropic: {
          ...anthropicOptions,
          ...(capability === 'adaptive'
            ? { thinking: { type: 'adaptive', display: 'summarized' }, effort: level }
            : { thinking: { type: 'enabled', budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS[level] } }),
        },
      } as typeof params.providerOptions;

      return params;
    },
  };
}

/**
 * Build a fetch function that handles Anthropic OAuth.
 * Preserves non-auth headers from init (critical for gateway auth header to survive
 * when used with the gateway). Strips `authorization` and `x-api-key`.
 */
export function buildAnthropicOAuthFetch(opts: { authStorage?: CredentialStore } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const storage = opts.authStorage ?? getAuthStorage();
    storage.reload();

    const storedCred = storage.get('anthropic');
    if (storedCred?.type === 'api_key') {
      throw new Error('Anthropic API key credential is configured, but OAuth is required.');
    }

    const accessToken = await storage.getApiKey('anthropic');
    if (!accessToken) {
      throw new ProviderAuthRequiredError('Not logged in to Anthropic.');
    }

    // Preserve Request headers and let explicit init headers override them.
    const headers = new Headers(url instanceof Request ? url.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.delete('authorization');
    headers.delete('x-api-key');
    headers.set('Authorization', `Bearer ${accessToken}`);
    const requestBetas = (headers.get('anthropic-beta') ?? '')
      .split(',')
      .map(beta => beta.trim())
      .filter(Boolean);
    headers.set('anthropic-beta', Array.from(new Set([...OAUTH_REQUIRED_BETAS, ...requestBetas])).join(','));
    headers.set('anthropic-version', '2023-06-01');

    try {
      return await fetch(url, { ...init, headers });
    } catch (error) {
      if (error && typeof error === 'object') {
        Object.assign(error as Record<string, unknown>, {
          requestUrl: url instanceof URL ? url.toString() : typeof url === 'string' ? url : url.url,
        });
      }
      throw error;
    }
  }) as typeof fetch;
}

/**
 * Creates an Anthropic model using Claude Max OAuth authentication
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed)
 */
export function opencodeClaudeMaxProvider(
  modelId: string = 'claude-sonnet-4-20250514',
  options?: {
    headers?: Record<string, string>;
    authStorage?: CredentialStore;
    thinkingLevel?: ThinkingLevel;
    promptCacheScope?: AnthropicPromptCacheScope;
  },
): MastraModelConfig {
  const headers = options?.headers;
  const thinkingMiddleware = createAnthropicThinkingMiddleware(modelId, options?.thinkingLevel);
  const middleware = [
    claudeCodeMiddleware,
    createPromptCacheMiddleware(options?.promptCacheScope ?? 'conversation'),
    ...(thinkingMiddleware ? [thinkingMiddleware] : []),
  ];

  // Test environment: use API key
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const anthropic = createAnthropic({
      apiKey: 'test-api-key',
      headers,
    });
    return wrapLanguageModel({
      model: anthropic(modelId),
      middleware,
    });
  }

  const anthropic = createAnthropic({
    apiKey: 'oauth-placeholder',
    headers,
    fetch: buildAnthropicOAuthFetch({ authStorage: options?.authStorage }) as any,
  });

  // Wrap with middleware to inject Claude Code identity and enable prompt caching
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware,
  });
}

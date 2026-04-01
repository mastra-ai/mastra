/**
 * Claude Max OAuth Provider
 *
 * Uses OAuth tokens from AuthStorage to authenticate with Claude Max plan.
 * The OAuth endpoint requires a specific system message to be present.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type { MastraModelConfig } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { AuthStorage } from '../auth/storage.js';

// Required for Claude Max plan OAuth - the endpoint checks for this system message
const claudeCodeIdentity = "You are Claude Code, Anthropic's official CLI for Claude.";

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
 * 2. Most recent user/assistant message (conversation context)
 *
 * This allows Anthropic to cache:
 * - System prompts and instructions (rarely change)
 * - Conversation history up to the last message
 */
export const promptCacheMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const prompt = [...params.prompt];

    const cacheControl = { type: 'ephemeral' as const, ttl: '5m' as const };

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
    if (lastIdx >= 0 && lastIdx !== lastSystemIdx) {
      prompt[lastIdx] = addCacheToMessage(prompt[lastIdx]);
    }

    return { ...params, prompt };
  },
};

/**
 * Build a fetch function that handles Anthropic OAuth.
 * Preserves non-auth headers from init (critical for gateway auth header to survive
 * when used with the gateway). Strips `authorization` and `x-api-key`.
 */
export function buildAnthropicOAuthFetch(opts: { authStorage?: AuthStorage } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const storage = opts.authStorage ?? getAuthStorage();
    storage.reload();

    const storedCred = storage.get('anthropic');
    if (storedCred?.type === 'api_key') {
      throw new Error('Anthropic API key credential is configured, but OAuth is required.');
    }

    const accessToken = await storage.getApiKey('anthropic');
    if (!accessToken) {
      throw new Error('Not logged in to Anthropic. Run /login first.');
    }

    // Preserve existing headers, strip auth-related ones
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
    headers.set(
      'anthropic-beta',
      'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14',
    );
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
  options?: { headers?: Record<string, string> },
): MastraModelConfig {
  const headers = options?.headers;

  // Test environment: use API key
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const anthropic = createAnthropic({
      apiKey: 'test-api-key',
      headers,
    });
    return wrapLanguageModel({
      model: anthropic(modelId),
      middleware: [claudeCodeMiddleware, promptCacheMiddleware],
    });
  }

  const anthropic = createAnthropic({
    apiKey: 'oauth-placeholder',
    headers,
    fetch: buildAnthropicOAuthFetch() as any,
  });

  // Wrap with middleware to inject Claude Code identity and enable prompt caching
  return wrapLanguageModel({
    model: anthropic(modelId),
    middleware: [claudeCodeMiddleware, promptCacheMiddleware],
  });
}

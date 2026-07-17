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
import type { CredentialStore } from '../auth/types.js';

// Codex API endpoint (not standard OpenAI API)
const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const CODEX_ORIGINATOR = 'mastracode';
const CODEX_USER_AGENT = 'mastracode';

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
 * Get a live OAuth bearer token for the Codex OAuth credential.
 *
 * Refreshes the token if it's expired, and returns the credential's
 * accountId alongside the access token. Throws if the user isn't logged in
 * or if the refresh fails.
 *
 * This is the only piece of Codex auth that is genuinely shared between
 * the main agent's fetch (`buildOpenAICodexOAuthFetch`) and the Stagehand
 * fetch (`buildCodexStagehandFetch`).
 */
async function getCodexBearer(
  authStorage?: CredentialStore,
): Promise<{ accessToken: string; accountId: string | undefined }> {
  const storage = authStorage ?? getAuthStorage();
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

  return { accessToken, accountId: (cred as any).accountId as string | undefined };
}

/**
 * Build a fetch function that handles OpenAI Codex OAuth.
 * Preserves non-authorization headers from init.
 * When rewriteUrl is true (default), rewrites /v1/responses and /chat/completions
 * to the Codex API endpoint. Set rewriteUrl: false for gateway usage where the
 * SDK already targets the correct URL.
 */
export function buildOpenAICodexOAuthFetch(
  opts: { authStorage?: CredentialStore; rewriteUrl?: boolean } = {},
): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    const { accessToken, accountId } = await getCodexBearer(opts.authStorage);

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
    if (!headers.has('originator')) {
      headers.set('originator', CODEX_ORIGINATOR);
    }
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', CODEX_USER_AGENT);
    }
    if (accountId) {
      headers.set('ChatGPT-Account-ID', accountId);
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
 * Build a fetch function for Stagehand-on-Codex.
 *
 * The Codex backend has two requirements that AI SDK's non-streaming
 * `generateText` path doesn't naturally satisfy:
 *
 *   1. `stream: true` must be set on every request body.
 *   2. The response is delivered as Server-Sent Events; AI SDK's
 *      non-streaming code path expects a single JSON body.
 *
 * This fetch forces streaming on the outgoing request, collects the SSE
 * events, and synthesizes the non-streaming JSON shape that
 * `@ai-sdk/openai`'s Responses API parser expects.
 *
 * Headers, OAuth refresh, and URL targeting are handled by the caller via
 * `baseURL` / `headers` on the AI SDK provider; this fetch only injects the
 * live OAuth bearer per call.
 */
export function buildCodexStagehandFetch(authStorage: AuthStorage): typeof fetch {
  return (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    // Refresh + inject the OAuth bearer per call
    const { accessToken } = await getCodexBearer(authStorage);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Accept', 'text/event-stream');

    // Force stream: true on the request body
    type FetchBody = NonNullable<Parameters<typeof fetch>[1]>['body'];
    let body: FetchBody | undefined = init?.body;
    if (typeof init?.body === 'string') {
      try {
        const parsed = JSON.parse(init.body) as Record<string, unknown>;
        parsed.stream = true;
        body = JSON.stringify(parsed);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      } catch {
        // Not JSON; leave as-is
      }
    }

    const upstream = await fetch(url, { ...init, headers, body });
    if (!upstream.ok) return upstream;

    // Aggregate SSE -> synthesized non-streaming Response
    const aggregated = await aggregateCodexStream(upstream);
    return new Response(aggregated, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

/**
 * Read an SSE Response and reduce it to a single JSON string matching the
 * non-streaming OpenAI Responses-API shape.
 *
 * Event vocabulary we care about (per OpenAI Responses API streaming):
 *   - response.created         → carries `response` object (id, model, usage stub)
 *   - response.output_item.added/done → output items (message, reasoning, etc.)
 *   - response.output_text.delta → text chunks
 *   - response.completed       → final `response` snapshot incl. usage
 *   - response.error / error   → bubble up as a thrown body
 *
 * Reasoning events (`response.reasoning_summary.*`) are intentionally ignored
 * for the non-streaming text response.
 */
async function aggregateCodexStream(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Codex streaming response had no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let finalResponse: any = null;
  let createdResponse: any = null;
  // Track output_items by index so we can rebuild the final array
  const items = new Map<number, any>();
  // Accumulate output_text deltas keyed by item_index + content_index
  const textBuffers = new Map<string, string>();

  const handleEvent = (event: { event?: string; data?: string }) => {
    if (!event.data || event.data === '[DONE]') return;
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    const type: string = payload.type ?? event.event ?? '';

    switch (type) {
      case 'response.created': {
        createdResponse = payload.response ?? createdResponse;
        break;
      }
      case 'response.output_item.added': {
        if (typeof payload.output_index === 'number' && payload.item) {
          items.set(payload.output_index, payload.item);
        }
        break;
      }
      case 'response.output_item.done': {
        if (typeof payload.output_index === 'number' && payload.item) {
          items.set(payload.output_index, payload.item);
        }
        break;
      }
      case 'response.output_text.delta': {
        const key = `${payload.output_index}:${payload.content_index ?? 0}`;
        textBuffers.set(key, (textBuffers.get(key) ?? '') + (payload.delta ?? ''));
        break;
      }
      case 'response.completed': {
        finalResponse = payload.response ?? finalResponse;
        break;
      }
      case 'response.error':
      case 'error': {
        throw new Error(`Codex stream error: ${JSON.stringify(payload.error ?? payload)}`);
      }
      default:
        // Ignore reasoning / unknown events
        break;
    }
  };

  // SSE parser: events separated by blank line; lines like "event: x" / "data: y"
  // Normalize CRLF→LF so \r\n\r\n event boundaries parse correctly (SSE spec allows CRLF).
  const processChunk = (chunk: string) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const event: { event?: string; data?: string } = {};
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
          event.event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length > 0) {
        event.data = dataLines.join('\n');
      }
      handleEvent(event);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      processChunk(decoder.decode(value, { stream: true }));
    }
    processChunk(decoder.decode());
  } finally {
    reader.releaseLock();
  }

  // Stitch accumulated text deltas back into their items
  const base = finalResponse ?? createdResponse ?? { output: [] };
  const finalItems = Array.from(items.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, item]) => {
      // Patch message-type items' content text using buffered deltas
      if (item?.type === 'message' && Array.isArray(item.content)) {
        item.content = item.content.map((c: any, ci: number) => {
          const key = `${index}:${ci}`;
          if (textBuffers.has(key)) {
            return { ...c, text: textBuffers.get(key) };
          }
          return c;
        });
      }
      return item;
    });

  base.output = finalItems.length > 0 ? finalItems : (base.output ?? []);

  return JSON.stringify(base);
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
  options?: { thinkingLevel?: ThinkingLevel; headers?: Record<string, string>; authStorage?: CredentialStore },
): MastraModelConfig {
  const requestedLevel: ThinkingLevel = options?.thinkingLevel ?? 'medium';
  const effectiveLevel = getEffectiveThinkingLevel(modelId, requestedLevel);
  const reasoningEffort = THINKING_LEVEL_TO_REASONING_EFFORT[effectiveLevel];
  const middleware = createCodexMiddleware(reasoningEffort);
  const headers = options?.headers;

  const baseURL = process.env.OPENAI_BASE_URL;

  // Test environment: use API key
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const openai = createOpenAI({
      apiKey: 'test-api-key',
      baseURL,
      headers,
    });
    return wrapLanguageModel({
      model: openai.responses(modelId),
      middleware: [middleware],
    });
  }

  const openai = createOpenAI({
    apiKey: 'oauth-dummy-key',
    baseURL,
    headers,
    fetch: buildOpenAICodexOAuthFetch({ authStorage: options?.authStorage }) as any,
  });

  // Use the responses API for Codex models
  // Wrap with middleware
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: [middleware],
  });
}

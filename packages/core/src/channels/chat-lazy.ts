import type { Chat } from 'chat';

import type * as ChatNS from 'chat';

type ChatModule = typeof ChatNS;

let cached: ChatModule | undefined;
let loading: Promise<ChatModule> | undefined;

/**
 * Lazily imports the `chat` package using a runtime-constructed module specifier.
 * This prevents bundlers (Vite/Rollup/esbuild) from resolving `chat` at build time,
 * which is necessary because the `chat` package is ESM-only (no CJS exports) and
 * breaks Vitest's module graph resolution when imported statically.
 */
export async function getChatModule(): Promise<ChatModule> {
  if (cached) {
    return cached;
  }
  if (!loading) {
    loading = (async () => {
      const mod = 'chat';
      const chatModule = await import(/* @vite-ignore */ /* webpackIgnore: true */ mod);
      cached = chatModule;
      return chatModule;
    })();
  }
  return loading;
}

/**
 * Synchronous accessor for the `chat` module.
 * Only safe to call after `getChatModule()` has been awaited (e.g. after `AgentChannels.initialize()`).
 */
export function chatModule(): ChatModule {
  if (!cached) {
    throw new Error('chat module not loaded yet — call getChatModule() first');
  }
  return cached;
}

export type { Chat };

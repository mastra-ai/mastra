/**
 * Shared Tiktoken singleton — lazy init, cached on globalThis.
 *
 * Uses dynamic import so the tokenizer is never loaded unless code actually
 * needs it. The instance is stored on globalThis so it can be reused across
 * packages without re-initializing (each init loads the full BPE rank table).
 */

import type { Tiktoken } from 'js-tiktoken/lite';

const GLOBAL_KEY = '__mastraTiktoken';

/**
 * Get or create the shared Tiktoken encoder instance.
 * Uses dynamic import so tiktoken is never loaded at module init time.
 * Cached on globalThis so the same instance is reused across packages.
 */
export async function getTiktoken(): Promise<Tiktoken> {
  const cached = (globalThis as Record<string, unknown>)[GLOBAL_KEY] as Tiktoken | undefined;
  if (cached) return cached;

  const { Tiktoken: TiktokenClass } = await import('js-tiktoken/lite');
  const o200k_base = (await import('js-tiktoken/ranks/o200k_base')).default;
  const enc = new TiktokenClass(o200k_base);
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = enc;
  return enc;
}

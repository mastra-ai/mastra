/**
 * TTL for Anthropic prompt-cache breakpoints written by `promptCacheMiddleware`.
 * Observational memory's idle activation for Anthropic is set to the same value,
 * so buffered observations don't activate while the cache is still warm.
 */
export const ANTHROPIC_PROMPT_CACHE_TTL = '1h' as const;

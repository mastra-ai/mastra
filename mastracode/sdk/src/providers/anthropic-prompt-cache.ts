/**
 * TTL for the main agent's Anthropic prompt-cache breakpoints.
 * Observational memory's idle activation for Anthropic is set to the same value,
 * so buffered observations don't activate while the cache is still warm.
 */
export const ANTHROPIC_PROMPT_CACHE_TTL = '1h' as const;

/**
 * Which Anthropic prompt-cache breakpoints a model writes.
 *
 * - `conversation`: the last system message and the latest message, with
 *   {@link ANTHROPIC_PROMPT_CACHE_TTL}. For the main agent, whose next request
 *   extends the same conversation.
 * - `system`: the last system message only, with a 5-minute TTL. For background
 *   calls (observer, reflector, thread titles) that share instructions across
 *   calls but send different content each time, so caching the content is a
 *   write that is never read.
 */
export type AnthropicPromptCacheScope = 'conversation' | 'system';

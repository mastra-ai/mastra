/**
 * Shared model constants for Mastra docs.
 *
 * Update the *values* here when a new model generation ships.
 * Every `__TOKEN__` reference in docs code blocks and inline code
 * is replaced at build time by the remark-model-tokens plugin.
 */

export const MODEL_TOKENS: Record<string, string> = {
  // ── OpenAI ────────────────────────────────────────────────
  __OPENAI_MODEL__: 'openai/gpt-5.4',
  __OPENAI_MODEL_MINI__: 'openai/gpt-5-mini',
  __OPENAI_MODEL_NANO__: 'openai/gpt-5-nano',
  __OPENAI_MODEL_BASE__: 'openai/gpt-5',
  __OPENAI_MODEL_REALTIME__: 'gpt-5.1-realtime',

  // ── Anthropic ─────────────────────────────────────────────
  __ANTHROPIC_MODEL_SONNET__: 'anthropic/claude-sonnet-4-6',
  __ANTHROPIC_MODEL_OPUS__: 'anthropic/claude-opus-4-6',
  __ANTHROPIC_MODEL_HAIKU__: 'anthropic/claude-haiku-4-5',
}

/**
 * Shared model constants for Mastra docs.
 *
 * Update the *values* here when a new model generation ships.
 * Every `__TOKEN__` reference in docs code blocks and inline code
 * is replaced at build time by the remark-model-tokens plugin.
 *
 * GATEWAY_ tokens use the `provider/model` format for Mastra's model routing.
 * AI_SDK_ tokens use the bare model name for direct AI SDK usage.
 */

export const MODEL_TOKENS: Record<string, string> = {
  // OpenAI
  __GATEWAY_OPENAI_MODEL__: 'openai/gpt-5.5',
  __GATEWAY_OPENAI_MODEL_MINI__: 'openai/gpt-5-mini',
  __GATEWAY_OPENAI_MODEL_NANO__: 'openai/gpt-5-nano',
  __GATEWAY_OPENAI_MODEL_BASE__: 'openai/gpt-5',
  __AI_SDK_OPENAI_MODEL_BASE__: 'gpt-5',
  __GATEWAY_OPENAI_EMBEDDING_MODEL__: 'openai/text-embedding-3-small',
  __AI_SDK_OPENAI_EMBEDDING_MODEL__: 'text-embedding-3-small',
  __AI_SDK_OPENAI_MODEL_REALTIME__: 'gpt-5.1-realtime',

  // Anthropic
  __GATEWAY_ANTHROPIC_MODEL_SONNET__: 'anthropic/claude-sonnet-4-6',
  __GATEWAY_ANTHROPIC_MODEL_OPUS__: 'anthropic/claude-opus-4-7',
  __GATEWAY_ANTHROPIC_MODEL_HAIKU__: 'anthropic/claude-haiku-4-5',
  __AI_SDK_ANTHROPIC_MODEL_SONNET__: 'claude-sonnet-4-6',

  // Google
  __GATEWAY_GOOGLE_MODEL__: 'google/gemini-2.5-pro',
  __GATEWAY_GOOGLE_MODEL_FLASH__: 'google/gemini-2.5-flash',

  // Alibaba
  __GATEWAY_ALIBABA_MODEL__: 'alibaba/qwen-max',

  // Amazon Bedrock
  __GATEWAY_BEDROCK_MODEL_OPUS__: 'amazon-bedrock/us.anthropic.claude-opus-4-6-v1',
  __GATEWAY_BEDROCK_MODEL_SONNET__: 'amazon-bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  __BEDROCK_MODEL_OPUS_BARE__: 'us.anthropic.claude-opus-4-6-v1',
  __BEDROCK_MODEL_SONNET_BARE__: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  __BEDROCK_MODEL_LLAMA_SCOUT_BARE__: 'us.meta.llama4-scout-17b-instruct-v1:0',
  __BEDROCK_MODEL_HAIKU_BARE__: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
}

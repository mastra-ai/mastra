export type PricingConditionField = 'total_input_tokens';
export type PricingConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export const PricingMeter = {
  INPUT_TOKENS: 'input_tokens',
  INPUT_AUDIO_TOKENS: 'input_audio_tokens',
  INPUT_CACHE_READ_TOKENS: 'input_cache_read_tokens',
  INPUT_CACHE_WRITE_TOKENS: 'input_cache_write_tokens',
  INPUT_IMAGE_TOKENS: 'input_image_tokens',

  OUTPUT_TOKENS: 'output_tokens',
  OUTPUT_AUDIO_TOKENS: 'output_audio_tokens',
  OUTPUT_IMAGE_TOKENS: 'output_image_tokens',
  OUTPUT_REASONING_TOKENS: 'output_reasoning_tokens',
} as const;

export type PricingMeter = (typeof PricingMeter)[keyof typeof PricingMeter];

export const TokenMetrics = {
  TOTAL_INPUT: 'mastra_model_total_input_tokens',
  TOTAL_OUTPUT: 'mastra_model_total_output_tokens',
  INPUT_TEXT: 'mastra_model_input_text_tokens',
  INPUT_CACHE_READ: 'mastra_model_input_cache_read_tokens',
  INPUT_CACHE_WRITE: 'mastra_model_input_cache_write_tokens',
  INPUT_AUDIO: 'mastra_model_input_audio_tokens',
  INPUT_IMAGE: 'mastra_model_input_image_tokens',
  OUTPUT_TEXT: 'mastra_model_output_text_tokens',
  OUTPUT_REASONING: 'mastra_model_output_reasoning_tokens',
  OUTPUT_AUDIO: 'mastra_model_output_audio_tokens',
  OUTPUT_IMAGE: 'mastra_model_output_image_tokens',
} as const;

export type TokenMetrics = (typeof TokenMetrics)[keyof typeof TokenMetrics];

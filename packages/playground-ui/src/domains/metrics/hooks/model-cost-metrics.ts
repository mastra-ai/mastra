export const MODEL_COST_TOTAL_METRICS = ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'] as const;

export const MODEL_USAGE_TOKEN_METRICS = [
  ...MODEL_COST_TOTAL_METRICS,
  'mastra_model_input_cache_read_tokens',
  'mastra_model_input_cache_write_tokens',
] as const;

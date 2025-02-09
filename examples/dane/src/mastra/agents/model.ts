import { createAnthropic } from '@ai-sdk/anthropic';

import { config } from '../../config/index.js';

export const getBaseModelConfig = () => {
  const anthropic = createAnthropic({
    apiKey: config.getAnthropicApiKey(),
  });
  return anthropic('claude-3-5-sonnet-20241022');
};

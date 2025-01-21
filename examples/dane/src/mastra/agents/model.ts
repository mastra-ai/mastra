import { config } from '../../config/index.js';

export const getBaseModelConfig = () => ({
  provider: 'ANTHROPIC' as const,
  toolChoice: 'auto' as const,
  name: 'claude-3-5-sonnet-20241022',
  apiKey: config.getAnthropicApiKey(),
});

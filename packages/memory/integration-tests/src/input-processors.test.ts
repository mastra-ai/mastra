import { openai as openaiV6 } from '@ai-sdk/openai-v6';

import { getInputProcessorsTests } from './shared/input-processors';

// Test with AI SDK v6 model functions
getInputProcessorsTests({
  version: 'v6',
  model: openaiV6('gpt-4o-mini'),
});

// Test with AI SDK v5 model configs (string format)
getInputProcessorsTests({
  version: 'v5',
  model: 'openai/gpt-4o-mini',
});

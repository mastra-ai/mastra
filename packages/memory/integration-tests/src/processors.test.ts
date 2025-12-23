import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@internal/ai-v6';
import { describe } from 'vitest';
import { getProcessorsTests } from './shared/processors';

describe('V5 Processors Tests', () => {
  getProcessorsTests({
    version: 'v5',
    model: 'openai/gpt-4o',
    legacyModel: openai('gpt-4o'),
  });
});

describe('V6 Processors Tests', () => {
  getProcessorsTests({
    version: 'v6',
    model: openaiV6('gpt-4o'),
    legacyModel: openaiV6('gpt-4o'),
  });
});

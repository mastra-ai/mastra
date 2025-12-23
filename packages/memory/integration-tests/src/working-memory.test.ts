import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { config } from 'dotenv';
import { getWorkingMemoryTests } from './shared/working-memory';

config({ path: '.env.test' });

// v4
getWorkingMemoryTests({
  model: openai('gpt-4o'),
});

// v5
getWorkingMemoryTests({
  model: 'openai/gpt-4o',
});

// v6
getWorkingMemoryTests({
  model: openaiV6('gpt-4o'),
});

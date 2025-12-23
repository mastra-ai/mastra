import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { config } from 'dotenv';
import { getWorkingMemoryTests } from './shared/working-memory';
import { getWorkingMemoryAdditiveTests } from './shared/working-memory-additive';

config({ path: '.env.test' });

// v4
// getWorkingMemoryTests(openai('gpt-4o'));
getWorkingMemoryAdditiveTests(openai('gpt-4o'));

// // v5
// getWorkingMemoryTests('openai/gpt-4o');
// getWorkingMemoryAdditiveTests('openai/gpt-4o');

// // v6
// getWorkingMemoryTests(openaiV6('gpt-4o'));
// getWorkingMemoryAdditiveTests(openaiV6('gpt-4o'));

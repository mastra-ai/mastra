import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { describe } from 'vitest';
import { getWorkingMemoryTests } from './shared/working-memory';
import { getWorkingMemoryAdditiveTests } from './shared/working-memory-additive';

// v4
describe('V4', () => {
  getWorkingMemoryTests(openai('gpt-4o'));
  getWorkingMemoryAdditiveTests(openai('gpt-4o'));
});

// v5
describe('V5', () => {
  getWorkingMemoryTests('openai/gpt-4o');
  getWorkingMemoryAdditiveTests('openai/gpt-4o');
});

// v6
describe('V6', () => {
  getWorkingMemoryTests(openaiV6('gpt-4o'));
  getWorkingMemoryAdditiveTests(openaiV6('gpt-4o'));
});

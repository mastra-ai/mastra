import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { describe } from 'vitest';
import { getWorkingMemoryTests } from './shared/working-memory';
import { getWorkingMemoryAdditiveTests } from './shared/working-memory-additive';

// v4 — gpt-5.2 is incompatible with AI SDK v4
describe('V4', () => {
  getWorkingMemoryTests(openai('gpt-4o'));
  getWorkingMemoryAdditiveTests(openai('gpt-4o'));
});

// v5 — gpt-5.2 for additive tests (gpt-4o consistently fails Large Real-World Schema)
describe('V5', () => {
  getWorkingMemoryTests('openai/gpt-4o');
  getWorkingMemoryAdditiveTests('openai/gpt-5.2');
});

// v6 — gpt-5.2 for additive tests (gpt-4o consistently fails Large Real-World Schema)
describe('V6', () => {
  getWorkingMemoryTests(openaiV6('gpt-4o'));
  getWorkingMemoryAdditiveTests(openaiV6('gpt-5.2'));
});

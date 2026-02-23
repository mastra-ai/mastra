import { anthropic as anthropicV6 } from '@ai-sdk/anthropic-v6';
import { google as googleV6 } from '@ai-sdk/google-v6';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';

import { describe } from 'vitest';
import { getMessageOrderingTests } from './shared/message-ordering';

// Test with AI SDK v5 model configs (string format)
describe('v5', () => {
  getMessageOrderingTests({
    version: 'v5',
    models: [
      {
        name: 'OpenAI GPT-4o',
        model: 'openai/gpt-4o',
        envVar: 'OPENAI_API_KEY',
      },
      {
        name: 'Anthropic Claude Sonnet',
        model: 'anthropic/claude-sonnet-4-5',
        envVar: 'ANTHROPIC_API_KEY',
      },
      {
        name: 'Google Gemini',
        model: 'google/gemini-pro-latest',
        envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
      },
    ],
  });
});
// Test with AI SDK v6 model functions
describe('v6', () => {
  getMessageOrderingTests({
    version: 'v6',
    models: [
      {
        name: 'OpenAI GPT-4o',
        model: openaiV6('gpt-4o'),
        envVar: 'OPENAI_API_KEY',
      },
      {
        name: 'Anthropic Claude Sonnet',
        model: anthropicV6('claude-sonnet-4-5'),
        envVar: 'ANTHROPIC_API_KEY',
      },
      {
        name: 'Google Gemini',
        model: googleV6('gemini-pro-latest'),
        envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
      },
    ],
  });
});

import { anthropic as anthropicV6 } from '@ai-sdk/anthropic-v6';
import { google as googleV6 } from '@ai-sdk/google-v6';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';

import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, beforeAll, describe } from 'vitest';
import { getMessageOrderingTests } from './shared/message-ordering';
import { transformRequest } from './transform-request';

const RECORDING_NAME = 'memory-integration-tests-src-message-ordering';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic', 'google']);

// Test with AI SDK v5 model configs (string format)
describe('v5', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME + '-v5',
    exactMatch: true,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  getMessageOrderingTests({
    version: 'v5',
    models: [
      {
        name: 'OpenAI GPT-4o',
        model: 'openai/gpt-4o',
      },
      {
        name: 'Anthropic Claude Sonnet',
        model: 'anthropic/claude-sonnet-4-5',
      },
      {
        name: 'Google Gemini',
        model: 'google/gemini-pro-latest',
      },
    ],
  });
});
// Test with AI SDK v6 model functions
describe('v6', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME + '-v6',
    exactMatch: true,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  getMessageOrderingTests({
    version: 'v6',
    models: [
      {
        name: 'OpenAI GPT-4o',
        model: openaiV6('gpt-4o'),
      },
      {
        name: 'Anthropic Claude Sonnet',
        model: anthropicV6('claude-sonnet-4-5'),
      },
      {
        name: 'Google Gemini',
        model: googleV6('gemini-pro-latest'),
      },
    ],
  });
});

import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { describe, beforeAll, afterAll } from 'vitest';
import { getWorkingMemoryTests } from './shared/working-memory';
import { getWorkingMemoryAdditiveTests } from './shared/working-memory-additive';
import { transformRequest } from './transform-request';

const RECORDING_NAME = 'memory-integration-tests-src-working-memory';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

// v4 — gpt-5.2 is incompatible with AI SDK v4
describe('V4', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME + '-v4',
    exactMatch: true,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  getWorkingMemoryTests(openai('gpt-4o'));
  getWorkingMemoryAdditiveTests(openai('gpt-4o'));
});

// v5 — gpt-5.2 for additive tests (gpt-4o consistently fails Large Real-World Schema)
describe('V5', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME + '-v5',
    exactMatch: true,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  getWorkingMemoryTests('openai/gpt-4o');
  getWorkingMemoryAdditiveTests('openai/gpt-5.2');
});

// v6 — gpt-5.2 for additive tests (gpt-4o consistently fails Large Real-World Schema)
describe('V6', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME + '-v6',
    exactMatch: true,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  getWorkingMemoryTests(openaiV6('gpt-4o'));
  getWorkingMemoryAdditiveTests(openaiV6('gpt-5.2'));
});

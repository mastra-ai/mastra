import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { useChat as useChatV5 } from '@ai-sdk/react-v5';
import { useChat as useChatV6 } from '@ai-sdk/react-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { describe, beforeAll, afterAll } from 'vitest';
import { setupStreamingMemoryTest } from './shared/streaming-memory';
import { setupUseChatV4, setupUseChatV5Plus } from './shared/useChat';
import { transformRequest } from './transform-request';
import { createWeatherMemory as createWeatherMemoryV4 } from './v4/mastra/agents/weather';
import { weatherTool as weatherToolV4 } from './v4/mastra/tools/weather';
import { createWeatherMemory as createWeatherMemoryV5 } from './v5/mastra/agents/weather';
import { weatherTool as weatherToolV5 } from './v5/mastra/tools/weather';
import { createWeatherMemory as createWeatherMemoryV6 } from './v6/mastra/agents/weather';
import { weatherTool as weatherToolV6 } from './v6/mastra/tools/weather';

const RECORDING_NAME = 'memory-integration-tests-src-streaming-memory';
const RECORDING_NAME_V4 = `${RECORDING_NAME}-v4`;
const RECORDING_NAME_V5 = `${RECORDING_NAME}-v5`;
const RECORDING_NAME_V6 = `${RECORDING_NAME}-v6`;

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

describe('v4', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME_V4,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  setupUseChatV4();
  setupStreamingMemoryTest({
    model: openai('gpt-4o'),
    tools: { get_weather: weatherToolV4 },
    createMemory: dbPath => createWeatherMemoryV4({ dbPath }),
    createIsolatedMemory: dbPath => createWeatherMemoryV4({ dbPath, semanticRecall: false, workingMemory: false }),
  });
});

describe('v5', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME_V5,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  setupUseChatV5Plus({ useChatFunc: useChatV5, version: 'v5' });
  setupStreamingMemoryTest({
    model: 'openai/gpt-4o',
    tools: { get_weather: weatherToolV5 },
    createMemory: dbPath => createWeatherMemoryV5({ dbPath }),
    createIsolatedMemory: dbPath => createWeatherMemoryV5({ dbPath, semanticRecall: false, workingMemory: false }),
  });
});

describe('v6', () => {
  const mock = createGatewayMock({
    name: RECORDING_NAME_V6,
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  setupUseChatV5Plus({ useChatFunc: useChatV6, version: 'v6' });
  setupStreamingMemoryTest({
    model: openaiV6('gpt-4o'),
    tools: { get_weather: weatherToolV6 },
    createMemory: dbPath => createWeatherMemoryV6({ dbPath }),
    createIsolatedMemory: dbPath => createWeatherMemoryV6({ dbPath, semanticRecall: false, workingMemory: false }),
  });
});

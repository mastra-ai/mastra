import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys, createGatewayMock } from '@internal/test-utils';
import { describe, beforeAll, afterAll } from 'vitest';
import { getAgentMemoryTests } from './shared/agent-memory';
import { transformRequest } from './transform-request';
import { weatherTool as weatherToolV4, weatherToolCity as weatherToolCityV4 } from './v4/mastra/tools/weather';
import { weatherTool as weatherToolV5, weatherToolCity as weatherToolCityV5 } from './v5/mastra/tools/weather';

const RECORDING_NAME = 'memory-integration-tests-src-agent-memory';
const MODE = getLLMTestMode();

// Set dummy API keys for replay/auto modes. These keys contain '-dummy-' so
// hasRealApiKey() will correctly identify them as dummy keys. The dummy keys
// satisfy provider validation while MSW intercepts the actual HTTP calls.
setupDummyApiKeys(MODE, ['openai', 'openrouter']);

// V4
describe('V4', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v4',
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: openai('gpt-4o-mini'),
    tools: {
      get_weather: weatherToolV4,
      get_weather_city: weatherToolCityV4,
    },
  });
});
// v5
describe('V5', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v5',
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: 'openai/gpt-4o-mini',
    tools: {
      get_weather: weatherToolV5,
      get_weather_city: weatherToolCityV5,
    },
    reasoningModel: 'openrouter/openai/gpt-oss-20b',
  });
});
// v6
describe('V6', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v6',
    transformRequest,
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: openaiV6('gpt-4o-mini'),
    tools: {
      get_weather: weatherToolV5,
      get_weather_city: weatherToolCityV5,
    },
  });
});

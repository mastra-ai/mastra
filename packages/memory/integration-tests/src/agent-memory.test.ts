import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { getLLMTestMode } from '@internal/llm-recorder';
import { shouldSkipLLMTest, setupDummyApiKeys, createGatewayMock } from '@internal/test-utils';
import { describe, beforeAll, afterAll } from 'vitest';
import { getAgentMemoryTests } from './shared/agent-memory';
import { weatherTool as weatherToolV4, weatherToolCity as weatherToolCityV4 } from './v4/mastra/tools/weather';
import { weatherTool as weatherToolV5, weatherToolCity as weatherToolCityV5 } from './v5/mastra/tools/weather';

const RECORDING_NAME = 'memory-integration-tests-src-agent-memory';
const MODE = getLLMTestMode();

// Check if OpenRouter tests should run (has real key or recordings exist)
const skipOpenRouter = shouldSkipLLMTest(MODE, 'openrouter', RECORDING_NAME);
// Set dummy API keys for replay/auto modes. These keys contain '-dummy-' so
// hasRealApiKey() will correctly identify them as dummy keys. The dummy keys
// satisfy provider validation while MSW intercepts the actual HTTP calls.
setupDummyApiKeys(MODE, ['openai', 'openrouter']);

// V4
describe('V4', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v4',
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: openai('gpt-4o-mini'),
    tools: {
      get_weather: weatherToolV4,
      get_weather_city: weatherToolCityV4,
    },
    recordingName: RECORDING_NAME,
  });
});
// v5
describe('V5', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v5',
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: 'openai/gpt-4o-mini',
    tools: {
      get_weather: weatherToolV5,
      get_weather_city: weatherToolCityV5,
    },
    // Include reasoningModel if we have a key or recordings exist
    ...(!skipOpenRouter ? { reasoningModel: 'openrouter/openai/gpt-oss-20b' } : {}),
    recordingName: RECORDING_NAME,
  });
});
// v6
describe('V6', async () => {
  const mock = createGatewayMock({
    exactMatch: true,
    name: RECORDING_NAME + '-v6',
  });
  beforeAll(() => mock.start());
  afterAll(() => mock.saveAndStop());

  await getAgentMemoryTests({
    model: openaiV6('gpt-4o-mini'),
    tools: {
      get_weather: weatherToolV5,
      get_weather_city: weatherToolCityV5,
    },
    recordingName: RECORDING_NAME,
  });
});

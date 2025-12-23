import { openai } from '@ai-sdk/openai';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
import { weatherTool as weatherToolV4, weatherToolCity as weatherToolCityV4 } from './v4/mastra/tools/weather';
import { weatherTool as weatherToolV5, weatherToolCity as weatherToolCityV5 } from './v5/mastra/tools/weather';
import { getAgentMemoryTests } from './shared/agent-memory';
import { config } from 'dotenv';

config();

// V4
getAgentMemoryTests({
  model: openai('gpt-4o-mini'),
  tools: {
    get_weather: weatherToolV4,
    get_weather_city: weatherToolCityV4,
  },
});
// v5
getAgentMemoryTests({
  model: 'openai/gpt-4o-mini',
  tools: {
    get_weather: weatherToolV5,
    get_weather_city: weatherToolCityV5,
  },
  reasoningModel: 'openrouter/openai/gpt-oss-20b',
});
// v6
getAgentMemoryTests({
  model: openaiV6('gpt-4o-mini'),
  tools: {
    get_weather: weatherToolV5,
    get_weather_city: weatherToolCityV5,
  },
});

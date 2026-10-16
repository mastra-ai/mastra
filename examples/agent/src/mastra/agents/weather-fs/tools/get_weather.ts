import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { WeatherCard } from '../ui/weather-card';

const STUB_WEATHER = [
  { conditions: 'sunny', baseCelsius: 26 },
  { conditions: 'partly cloudy', baseCelsius: 19 },
  { conditions: 'light rain', baseCelsius: 13 },
  { conditions: 'thunderstorm', baseCelsius: 17 },
  { conditions: 'snow', baseCelsius: -2 },
  { conditions: 'fog', baseCelsius: 8 },
];

/**
 * File-based tool: the default export is registered on the agent with the tool
 * key `get_weather` (the filename). No manual wiring needed.
 */
export default createTool({
  id: 'get-weather',
  description: 'Fetches the current weather for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  outputSchema: z.object({
    city: z.string(),
    conditions: z.string(),
    temperatureCelsius: z.number(),
  }),
  execute: async ({ city }) => {
    // Stubbed response, varied per city so the Studio card has different weather to draw.
    // Swap in a real API for production use.
    const hash = [...city.toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const { conditions, baseCelsius } = STUB_WEATHER[hash % STUB_WEATHER.length]!;
    return {
      city,
      conditions,
      temperatureCelsius: baseCelsius + Math.round(Math.random() * 4 - 2),
    };
  },
  ui: { studioComponent: WeatherCard },
});

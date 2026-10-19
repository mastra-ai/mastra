import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { WeatherCard } from '@/components/weather-card';

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Gets the current temperature for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temperature: z.number() }),
  execute: async () => ({ temperature: 21 }),
  ui: { studioComponent: WeatherCard },
});

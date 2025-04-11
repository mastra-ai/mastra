'use server';

import { mastra } from '@/src/mastra';

export async function generateWeatherPlan(city: string) {
  const agent = mastra.getAgent('weatherAgent');
  const response = await agent.generate([
    {
      role: 'user',
      content: `What is the weather in ${city}?`,
    },
  ]);

  return response.text;
}

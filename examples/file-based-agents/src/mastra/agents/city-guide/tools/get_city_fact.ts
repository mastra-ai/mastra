import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const cityFacts = {
  Tokyo: 'Tokyo has the busiest railway station in the world: Shinjuku Station.',
  Paris: 'Paris has more than 100 museums.',
  'New York': 'New York City has more than 800 languages spoken across its five boroughs.',
} as const;

export default createTool({
  id: 'get-city-fact',
  description: 'Gets a fact about Tokyo, Paris, or New York',
  inputSchema: z.object({
    city: z.enum(['Tokyo', 'Paris', 'New York']),
  }),
  outputSchema: z.object({
    city: z.string(),
    fact: z.string(),
  }),
  execute: async ({ city }) => ({
    city,
    fact: cityFacts[city],
  }),
});

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const getCatFact = async () => {
  const { fact } = (await fetch('https://catfact.ninja/fact').then(res => res.json())) as {
    fact: string;
  };
  return fact;
};

export const catFact = createTool({
  id: 'Get cat facts',
  inputSchema: z.object({}),
  description: 'Fetches cat facts',
  execute: async () => {
    console.log('using tool to fetch cat fact');
    return {
      catFact: await getCatFact(),
    };
  },
});

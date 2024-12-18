import { createTool } from '@mastra/core';
import { z } from 'zod';

const getCatFact = async () => {
  const { text } = (await fetch('https://cat-fact.herokuapp.com/facts/random').then(res => res.json())) as {
    text: string;
  };
  return text;
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

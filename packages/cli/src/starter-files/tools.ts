import { createTool } from '@mastra/core';
import { z } from 'zod';

const getCatFact = async () => {
  const { text } = (await fetch('https://cat-fact.herokuapp.com/facts/random').then(res => res.json())) as {
    text: string;
  };
  return text;
};

export const catFact = createTool({
  label: 'Get cat facts',
  schema: z.object({}),
  description: 'Fetches cat facts',
  executor: async () => {
    console.log('using tool to fetch cat fact');
    return {
      catFact: await getCatFact(),
    };
  },
});

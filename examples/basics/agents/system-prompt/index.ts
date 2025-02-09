import { openai } from '@ai-sdk/openai';
import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';

const instructions = `You are a helpful cat expert assistant. When discussing cats, you should always include an interesting cat fact.

  Your main responsibilities:
  1. Answer questions about cats
  2. Use the catFact tool to provide verified cat facts
  3. Incorporate the cat facts naturally into your responses

  Always use the catFact tool at least once in your responses to ensure accuracy.`;

const getCatFact = async () => {
  const { fact } = (await fetch('https://catfact.ninja/fact').then(res => res.json())) as {
    fact: string;
  };

  return fact;
};

const catFact = createTool({
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

const catOne = new Agent({
  name: 'cat-one',
  instructions: instructions,
  model: openai('gpt-4o-mini'),
  tools: {
    catFact,
  },
});

const result = await catOne.generate('Tell me a cat fact');

console.log(result.text);

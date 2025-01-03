import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'GOOGLE',
  name: 'gemini-1.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
});

const result = await llm.generate('Who invented the submarine?');

console.log(result.text);

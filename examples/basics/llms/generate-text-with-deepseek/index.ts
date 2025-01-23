import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'DEEPSEEK',
  name: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const response = await llm.generate('What is a wormhole?');

console.log(response.text);

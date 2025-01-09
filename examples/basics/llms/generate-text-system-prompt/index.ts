import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

dotenv.config();

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'OPEN_AI',
  name: 'gpt-4',
});

const response = await llm.generate([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the meaning of life?' },
]);

console.log(response.text);

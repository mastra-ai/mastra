import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

dotenv.config();

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'OPEN_AI',
  name: 'gpt-4o',
});

const response = await llm.generate('What is a wormhole?');

console.log(response.text);

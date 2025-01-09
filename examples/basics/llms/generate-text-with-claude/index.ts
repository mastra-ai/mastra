import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

dotenv.config();

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'ANTHROPIC',
  name: 'claude-3-5-sonnet-20241022',
});

const result = await llm.generate('Who invented the submarine?');

console.log(result.text);

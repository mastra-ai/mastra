import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

dotenv.config();

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'OPEN_AI',
  name: 'gpt-4',
});

const response = await llm.stream('Tell me about christmas and it"s traditions');

for await (const chunk of response.textStream) {
  process.stdout.write(chunk);
}

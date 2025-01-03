import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'ANTHROPIC',
  name: 'claude-3-5-sonnet-20241022',
});

const result = await llm.generate('Who invented the submarine?');

console.log(result.text);

import { Mastra } from '@mastra/core';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'DEEPSEEK',
  name: 'deepseek-reasoner',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const response = await llm.generate(
  "Solve this logical puzzle step by step: Three friends - Alice, Bob, and Charlie - are wearing different colored hats (red, blue, green). Alice says she sees a blue hat. Bob says he sees a green hat. Charlie says he sees a red hat. Each person can see the others' hats but not their own. If exactly one person is lying, what color hat is each person wearing?",
);

console.log(response.text);

export const faithfulnessScorer = `
import { openai } from "@ai-sdk/openai";
import { createFaithfulnessScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createFaithfulnessScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "The Tesla Model 3 was launched in 2017.",
    "It has a range of up to 358 miles.",
    "The base model accelerates 0-60 mph in 5.8 seconds."
  ]
});
 
const query = "Tell me about the Tesla Model 3.";
const response = "The Tesla Model 3 was introduced in 2017. It can travel up to 358 miles on a single charge and the base version goes from 0 to 60 mph in 5.8 seconds.";
 
const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});
 
console.log(result);`;

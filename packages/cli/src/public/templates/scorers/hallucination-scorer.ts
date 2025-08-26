export const hallucinationScorer = `
import { openai } from "@ai-sdk/openai";
import { createHallucinationScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createHallucinationScorer({ model: openai("gpt-4o-mini"), options: {
  context: [
    "The iPhone was first released in 2007.",
    "Steve Jobs unveiled it at Macworld.",
    "The original model had a 3.5-inch screen."
  ]
});
 
const query = "When was the first iPhone released?";
const response = "The iPhone was first released in 2007, when Steve Jobs unveiled it at Macworld. The original iPhone featured a 3.5-inch screen.";
 
const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});
 
console.log(result);`;

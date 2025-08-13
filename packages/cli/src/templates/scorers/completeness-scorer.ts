export const completenessScorer = `
import { openai } from "@ai-sdk/openai";
import { createCompletenessScorer } from "@mastra/evals/scorers/llm";
 
const scorer = createCompletenessScorer({ model: openai("gpt-4o-mini") });
 
const query = "Explain the process of photosynthesis, including the inputs, outputs, and stages involved.";
const response =
  "Photosynthesis is the process by which plants convert sunlight into chemical energy. Inputs: Carbon dioxide (CO2) from the air enters through stomata, water (H2O) is absorbed by roots, and sunlight provides energy captured by chlorophyll. The process occurs in two main stages: 1) Light-dependent reactions in the thylakoids convert light energy to ATP and NADPH while splitting water and releasing oxygen. 2) Light-independent reactions (Calvin cycle) in the stroma use ATP, NADPH, and CO2 to produce glucose. Outputs: Glucose (C6H12O6) serves as food for the plant, and oxygen (O2) is released as a byproduct. The overall equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2.";
 
const result = await scorer.run({
  input: [{ role: 'user', content: query }],
  output: { text: response },
});
 
console.log(result);`;

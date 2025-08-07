import { mastra } from './src/mastra';
import { glutenCheckerScorer } from './src/mastra/evals/gluten-checker';

const chefAgent = mastra.getAgent('chefAgent');

// Example 1: Recipe with gluten
const input1 = 'Can you give me a simple pasta recipe with exact measurements and timing?';

console.log('Example 1 - Recipe with Gluten:');
console.log('Input:', input1);

const response1 = await chefAgent.generate(input1);
console.log('Agent Response:', response1.text);
const result1 = await glutenCheckerScorer.run({
  input: [{ role: 'user', content: input1 }],
  output: { text: response1.text },
});
console.log('Metric Result:', {
  score: result1.score,
  glutenSources: result1.analyzeStepResult?.glutenSources,
  reason: result1.reason,
});

// Example 2: Gluten-free recipe
const input2 = 'What is a quick way to make rice and beans?';

console.log('\nExample 2 - Gluten-Free Recipe:');
console.log('Input:', input2);

const response2 = await chefAgent.generate(input2);
console.log('Agent Response:', response2.text);
const result2 = await glutenCheckerScorer.run({
  input: [{ role: 'user', content: input2 }],
  output: { text: response2.text },
});
console.log('Metric Result:', {
  score: result2.score,
  glutenSources: result2.analyzeStepResult?.glutenSources,
  reason: result2.reason,
});

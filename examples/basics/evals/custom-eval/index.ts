import { mastra } from './src/mastra';

const chefAgent = mastra.getAgent('chefAgent');

const metric = chefAgent.evals.glutenChecker;

// Example 1: Recipe with gluten
const input1 = 'Can you give me a simple pasta recipe with exact measurements and timing?';

console.log('Example 1 - Recipe with Gluten:');
console.log('Input:', input1);

const response1 = await chefAgent.generate(input1);
console.log('Agent Response:', response1.text);
const result1 = await metric.measure(response1.text);
console.log('Metric Result:', {
  score: result1.score,
  glutenSources: result1.info.glutenSources,
  reason: result1.info.reason,
});

// Example 2: Gluten-free recipe
const input2 = 'What is a quick way to make rice and beans?';

console.log('\nExample 2 - Gluten-Free Recipe:');
console.log('Input:', input2);

const response2 = await chefAgent.generate(input2);
console.log('Agent Response:', response2.text);
const result2 = await metric.measure(response2.text);
console.log('Metric Result:', {
  score: result2.score,
  glutenSources: result2.info.glutenSources,
  reason: result2.info.reason,
});

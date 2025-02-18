import { mastra } from './mastra';

const chefAgent = mastra.getAgent('chefAgent');

const metric = chefAgent.evals.recipeCompleteness;

// Example 1: Complete recipe with all components
const input1 = 'Can you give me a simple pasta recipe with exact measurements and timing?';

console.log('Example 1 - Complete Recipe Request:');
console.log('Input:', input1);

const response1 = await chefAgent.generate(input1);
console.log('Agent Response:', response1.text);
const result1 = await metric.measure(input1, response1.text);
console.log('Metric Result:', {
  score: result1.score,
  missing: result1.info.missing,
  reason: result1.info.reason,
});

// Example 2: Request likely to generate incomplete recipe
const input2 = 'What is a quick way to make soup?';

console.log('\nExample 2 - Quick Recipe Request:');
console.log('Input:', input2);

const response2 = await chefAgent.generate(input2);
console.log('Agent Response:', response2.text);
const result2 = await metric.measure(input2, response2.text);
console.log('Metric Result:', {
  score: result2.score,
  missing: result2.info.missing,
  reason: result2.info.reason,
});

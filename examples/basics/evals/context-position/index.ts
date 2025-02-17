import { openai } from '@ai-sdk/openai';
import { ContextPositionMetric } from '@mastra/evals/llm';

// Example 1: High position adherence (relevant info first)
const context1 = [
  'The capital of France is Paris.',
  'Paris has been the capital since 508 CE.',
  "Paris serves as France's political center.",
  'The capital city hosts the French government.',
];

const metric1 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'What is the capital of France?';
const response1 = 'The capital of France is Paris.';

console.log('\nExample 1 - High Position Adherence:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed position adherence (relevant info scattered)
const context2 = [
  'Elephants are herbivores.',
  'Adult elephants can weigh up to 13,000 pounds.',
  'Elephants are the largest land animals.',
  'Elephants eat plants and grass.',
];

const metric2 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'How much do elephants weigh?';
const response2 = 'Adult elephants can weigh up to 13,000 pounds, making them the largest land animals.';

console.log('\nExample 2 - Mixed Position Adherence:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low position adherence (relevant info last)
const context3 = [
  'Rainbows appear in the sky.',
  'Rainbows have different colors.',
  'Rainbows are curved in shape.',
  'Rainbows form when sunlight hits water droplets.',
];

const metric3 = new ContextPositionMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'How do rainbows form?';
const response3 = 'Rainbows are created when sunlight interacts with water droplets in the air.';

console.log('\nExample 3 - Low Position Adherence:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

import { openai } from '@ai-sdk/openai';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

// Example 1: High precision (all context relevant)
const context1 = [
  'Photosynthesis converts sunlight into energy.',
  'Plants use chlorophyll for photosynthesis.',
  'Photosynthesis produces oxygen as a byproduct.',
  'The process requires sunlight and chlorophyll.',
];

const metric1 = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'What is photosynthesis and how does it work?';
const response1 =
  'Photosynthesis is a process where plants convert sunlight into energy using chlorophyll, producing oxygen as a byproduct.';

console.log('\nExample 1 - High Precision:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed precision (some irrelevant context)
const context2 = [
  "Volcanoes are openings in the Earth's crust.",
  'Volcanoes can be active, dormant, or extinct.',
  'Hawaii has many active volcanoes.',
  'The Pacific Ring of Fire has many volcanoes.',
];

const metric2 = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'What are the different types of volcanoes?';
const response2 = 'Volcanoes can be classified as active, dormant, or extinct based on their activity status.';

console.log('\nExample 2 - Mixed Precision:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low precision (mostly irrelevant context)
const context3 = [
  'The Nile River is in Africa.',
  'The Nile is the longest river.',
  'Ancient Egyptians used the Nile.',
  'The Nile flows north.',
];

const metric3 = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'Which direction does the Nile River flow?';
const response3 = 'The Nile River flows northward.';

console.log('\nExample 3 - Low Precision:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

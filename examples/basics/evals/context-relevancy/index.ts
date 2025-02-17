import { openai } from '@ai-sdk/openai';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

// Example 1: High relevancy (all context relevant)
const context1 = [
  'Einstein won the Nobel Prize for his discovery of the photoelectric effect.',
  'He published his theory of relativity in 1905.',
  'His work revolutionized modern physics.',
];

const metric1 = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = "What were some of Einstein's achievements?";
const response1 =
  'Einstein won the Nobel Prize for discovering the photoelectric effect and published his groundbreaking theory of relativity.';

console.log('Example 1 - High Relevancy:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed relevancy (some context irrelevant)
const context2 = [
  'Solar eclipses occur when the Moon blocks the Sun.',
  'The Moon moves between the Earth and Sun during eclipses.',
  'The Moon is visible at night.',
  'The Moon has no atmosphere.',
];

const metric2 = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'What causes solar eclipses?';
const response2 = 'Solar eclipses happen when the Moon moves between Earth and the Sun, blocking sunlight.';

console.log('Example 2 - Mixed Relevancy:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low relevancy (mostly irrelevant context)
const context3 = [
  'The Great Barrier Reef is in Australia.',
  'Coral reefs need warm water to survive.',
  'Marine life depends on coral reefs.',
  'The capital of Australia is Canberra.',
];

const metric3 = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'What is the capital of Australia?';
const response3 = 'The capital of Australia is Canberra.';

console.log('Example 3 - Low Relevancy:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

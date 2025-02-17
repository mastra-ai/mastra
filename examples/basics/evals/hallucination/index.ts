import { openai } from '@ai-sdk/openai';
import { HallucinationMetric } from '@mastra/evals/llm';

// Example 1: No hallucination (output matches context)
const context1 = [
  'The iPhone was first released in 2007.',
  'Steve Jobs unveiled it at Macworld.',
  'The original model had a 3.5-inch screen.',
];

const metric1 = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'When was the first iPhone released?';
const response1 =
  'The iPhone was first released in 2007, when Steve Jobs unveiled it at Macworld. The original iPhone featured a 3.5-inch screen.';

console.log('\nExample 1 - No Hallucination:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed hallucination (some facts correct, some wrong)
const context2 = [
  'The first Star Wars movie was released in 1977.',
  'It was directed by George Lucas.',
  'The film earned $775 million worldwide.',
  'The movie was filmed in Tunisia and England.',
];

const metric2 = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'Tell me about the first Star Wars movie.';
const response2 =
  'The first Star Wars movie came out in 1977 and was directed by George Lucas. It made over $1 billion at the box office and was filmed entirely in California.';

console.log('\nExample 2 - Mixed Hallucination:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Complete hallucination (all facts wrong)
const context3 = [
  'The Wright brothers made their first flight in 1903.',
  'The flight lasted 12 seconds.',
  'It covered a distance of 120 feet.',
];

const metric3 = new HallucinationMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'When did the Wright brothers first fly?';
const response3 =
  'The Wright brothers achieved their historic first flight in 1908. The flight lasted about 2 minutes and covered nearly a mile.';

console.log('\nExample 3 - Complete Hallucination:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

import { openai } from '@ai-sdk/openai';
import { ContextualRecallMetric } from '@mastra/evals/llm';

// Example 1: High recall (response includes all context)
const context1 = ['Product features include cloud sync.', 'Offline mode is available.', 'Supports multiple devices.'];

const metric1 = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'What are the key features of the product?';
const response1 =
  'The product features cloud synchronization, offline mode support, and the ability to work across multiple devices.';

console.log('\nExample 1 - High Recall:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed recall (response includes some context)
const context2 = [
  'Python is a high-level programming language.',
  'Python emphasizes code readability.',
  'Python supports multiple programming paradigms.',
  'Python is widely used in data science.',
];

const metric2 = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = "What are Python's key characteristics?";
const response2 = 'Python is a high-level programming language. It is also a type of snake.';

console.log('\nExample 2 - Mixed Recall:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low recall (response misses most context)
const context3 = [
  'The solar system has eight planets.',
  'Mercury is closest to the Sun.',
  'Venus is the hottest planet.',
  'Mars is called the Red Planet.',
];

const metric3 = new ContextualRecallMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'Tell me about the solar system.';
const response3 = 'Jupiter is the largest planet in the solar system.';

console.log('\nExample 3 - Low Recall:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

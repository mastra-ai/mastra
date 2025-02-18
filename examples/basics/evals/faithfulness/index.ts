import { openai } from '@ai-sdk/openai';
import { FaithfulnessMetric } from '@mastra/evals/llm';

// Example 1: High faithfulness (all claims supported by context)
const context1 = [
  'The Tesla Model 3 was launched in 2017.',
  'It has a range of up to 358 miles.',
  'The base model accelerates 0-60 mph in 5.8 seconds.',
];

const metric1 = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: context1,
});

const query1 = 'Tell me about the Tesla Model 3.';
const response1 =
  'The Tesla Model 3 was introduced in 2017. It can travel up to 358 miles on a single charge and the base version goes from 0 to 60 mph in 5.8 seconds.';

console.log('Example 1 - High Faithfulness:');
console.log('Context:', context1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Mixed faithfulness (some claims supported, some unsupported)
const context2 = [
  'Python was created by Guido van Rossum.',
  'The first version was released in 1991.',
  'Python emphasizes code readability.',
];

const metric2 = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: context2,
});

const query2 = 'What can you tell me about Python?';
const response2 =
  'Python was created by Guido van Rossum and released in 1991. It is the most popular programming language today and is used by millions of developers worldwide.';

console.log('Example 2 - Mixed Faithfulness:');
console.log('Context:', context2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Low faithfulness (claims contradict context)
const context3 = [
  'Mars is the fourth planet from the Sun.',
  'It has a thin atmosphere of mostly carbon dioxide.',
  'Two small moons orbit Mars: Phobos and Deimos.',
];

const metric3 = new FaithfulnessMetric(openai('gpt-4o-mini'), {
  context: context3,
});

const query3 = 'What do we know about Mars?';
const response3 =
  'Mars is the third planet from the Sun. It has a thick atmosphere rich in oxygen and nitrogen, and is orbited by three large moons.';

console.log('Example 3 - Low Faithfulness:');
console.log('Context:', context3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

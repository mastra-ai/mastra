import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

// Example 1: Perfect alignment (all instructions followed)
const instructions1 = [
  'Use complete sentences',
  'Include temperature in Celsius',
  'Mention wind conditions',
  'State precipitation chance',
];

const metric1 = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: instructions1,
});

const query1 = 'What is the weather like?';
const response1 =
  'The temperature is 22 degrees Celsius with moderate winds from the northwest. There is a 30% chance of rain.';

console.log('Example 1 - Perfect Alignment:');
console.log('Instructions:', instructions1);
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric1.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
  details: result1.info.scoreDetails,
});

// Example 2: Mixed alignment (some instructions missed)
const instructions2 = ['Use bullet points', 'Include prices in USD', 'Show stock status', 'Add product descriptions'];

const metric2 = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: instructions2,
});

const query2 = 'List the available products';
const response2 = '• Coffee - $4.99 (In Stock)\n• Tea - $3.99\n• Water - $1.99 (Out of Stock)';

console.log('Example 2 - Mixed Alignment:');
console.log('Instructions:', instructions2);
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric2.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
  details: result2.info.scoreDetails,
});

// Example 3: N/A instructions (all instructions not applicable)
const instructions3 = ['Show account balance', 'List recent transactions', 'Display payment history'];

const metric3 = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
  instructions: instructions3,
});

const query3 = 'What is the weather like?';
const response3 = 'It is sunny and warm outside.';

console.log('Example 3 - N/A Instructions:');
console.log('Instructions:', instructions3);
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric3.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
  details: result3.info.scoreDetails,
});

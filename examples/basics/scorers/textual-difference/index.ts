import { createTextualDifferenceScorer } from '@mastra/evals/scorers/code';

// Configure the metric
const metric = createTextualDifferenceScorer();

// Example 1: Identical texts
const input1 = 'The quick brown fox jumps over the lazy dog';
const output1 = 'The quick brown fox jumps over the lazy dog';

console.log('Example 1 - Identical Texts:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric.run({
  input: [{ role: 'user', content: input1 }],
  output: { role: 'assistant', text: output1 },
});
console.log('Metric Result:', {
  score: result1.score,
  analyzeStepResult: result1.analyzeStepResult,
});

// Example 2: Minor differences
const input2 = 'Hello world! How are you?';
const output2 = 'Hello there! How is it going?';

console.log('Example 2 - Minor Differences:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric.run({
  input: [{ role: 'user', content: input2 }],
  output: { role: 'assistant', text: output2 },
});
console.log('Metric Result:', {
  score: result2.score,
  analyzeStepResult: result2.analyzeStepResult,
});

// Example 3: Major differences
const input3 = 'Python is a high-level programming language';
const output3 = 'JavaScript is used for web development';

console.log('Example 3 - Major Differences:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric.run({
  input: [{ role: 'user', content: input3 }],
  output: { role: 'assistant', text: output3 },
});

console.log('Metric Result:', {
  score: result3.score,
  analyzeStepResult: result3.analyzeStepResult,
});

import { createToneScorer } from '@mastra/evals/scorers/code';

// Configure the metric
const metric = createToneScorer();

// Example 1: Consistent positive tone
const input1 = 'This product is fantastic and amazing!';
const output1 = 'The product is excellent and wonderful!';

console.log('Example 1 - Consistent Positive Tone:');
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

// Example 2: Tone stability in single text
const input2 = 'Great service! Friendly staff. Perfect atmosphere.';
const output2 = ''; // Empty string for stability analysis

console.log('Example 2 - Tone Stability:');
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

// Example 3: Mixed tone comparison
const input3 = 'The interface is frustrating and confusing, though it has potential.';
const output3 = 'The design shows promise but needs significant improvements to be usable.';

console.log('Example 3 - Mixed Tone:');
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

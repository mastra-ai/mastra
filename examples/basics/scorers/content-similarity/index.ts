import { createContentSimilarityScorer } from '@mastra/evals/scorers/code';

// Configure the scorer
const scorer = createContentSimilarityScorer();

// Example 1: High similarity
const input1 = 'The quick brown fox jumps over the lazy dog.';
const output1 = 'A quick brown fox jumped over a lazy dog.';

console.log('Example 1 - High Similarity:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await scorer.run({
  input: [{ role: 'user', content: input1 }],
  output: { role: 'assistant', text: output1 },
});

console.log('Metric Result:', {
  score: result1.score,
  extractStepResult: result1.extractStepResult,
});

// Example 2: Moderate similarity
const input2 = 'The quick brown fox jumps over the lazy dog.';
const output2 = 'A brown fox quickly leaps across a sleeping dog.';

console.log('Example 2 - Moderate Similarity:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await scorer.run({
  input: [{ role: 'user', content: input2 }],
  output: { role: 'assistant', text: output2 },
});

console.log('Metric Result:', {
  score: result2.score,
  extractStepResult: result2.extractStepResult,
});

// Example 3: Low similarity
const input3 = 'The quick brown fox jumps over the lazy dog.';
const output3 = 'The cat sleeps on the windowsill.';

console.log('Example 3 - Low Similarity:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await scorer.run({
  input: [{ role: 'user', content: input3 }],
  output: { role: 'assistant', text: output3 },
});

console.log('Metric Result:', {
  score: result3.score,
  extractStepResult: result3.extractStepResult,
});

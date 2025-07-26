import { createCompletenessScorer } from '@mastra/evals/scorers/code';

// Configure the scorer
const scorer = createCompletenessScorer();

// Example 1: Complete coverage
const input = 'The primary colors are red, blue, and yellow.';
const output = 'The primary colors are red, blue, and yellow.';

console.log('Example 1 - Complete Coverage:');
console.log('Input:', input);
console.log('Output:', output);

const result1 = await scorer.run({
  input: [{ role: 'user', content: input }],
  output: { role: 'assistant', text: output },
});

console.log('Scorer Result:', {
  score: result1.score,
  extractStepResult: {
    missingElements: result1.extractStepResult?.missingElements,
    elementCounts: result1.extractStepResult?.elementCounts,
  },
});

// Example 2: Partial coverage
const input2 = 'The primary colors are red, blue, and yellow.';
const output2 = 'The primary colors are red and blue.';

console.log('Example 2 - Partial Coverage:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await scorer.run({
  input: [{ role: 'user', content: input2 }],
  output: { role: 'assistant', text: output2 },
});
console.log('Scorer Result:', {
  score: result2.score,
  extractStepResult: {
    missingElements: result2.extractStepResult?.missingElements,
    elementCounts: result2.extractStepResult?.elementCounts,
  },
});

// Example 3: Minimal coverage
const input3 = 'The four seasons are spring, summer, fall, and winter.';
const output3 = 'The seasons include summer.';

console.log('Example 3 - Minimal Coverage:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await scorer.run({
  input: [{ role: 'user', content: input3 }],
  output: { role: 'assistant', text: output3 },
});
console.log('Scorer Result:', {
  score: result3.score,
  extractStepResult: {
    missingElements: result3.extractStepResult?.missingElements,
    elementCounts: result3.extractStepResult?.elementCounts,
  },
});

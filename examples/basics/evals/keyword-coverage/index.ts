import { KeywordCoverageMetric } from '@mastra/evals/nlp';

// Configure the metric
const metric = new KeywordCoverageMetric();

// Example 1: Full keyword coverage
const input1 = 'JavaScript frameworks like React and Vue';
const output1 = 'Popular JavaScript frameworks include React and Vue for web development';

console.log('Example 1 - Full Coverage:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  info: {
    totalKeywords: result1.info.totalKeywords,
    matchedKeywords: result1.info.matchedKeywords,
  },
});

// Example 2: Partial keyword coverage
const input2 = 'TypeScript offers interfaces, generics, and type inference';
const output2 = 'TypeScript provides type inference and some advanced features';

console.log('Example 2 - Partial Coverage:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  info: {
    totalKeywords: result2.info.totalKeywords,
    matchedKeywords: result2.info.matchedKeywords,
  },
});

// Example 3: Minimal keyword coverage
const input3 = 'Machine learning models require data preprocessing, feature engineering, and hyperparameter tuning';
const output3 = 'Data preparation is important for models';

console.log('Example 3 - Minimal Coverage:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  info: {
    totalKeywords: result3.info.totalKeywords,
    matchedKeywords: result3.info.matchedKeywords,
  },
});

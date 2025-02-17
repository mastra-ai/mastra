import { CompletenessMetric } from '@mastra/evals/nlp';

// Configure the metric
const metric = new CompletenessMetric();

// Example 1: Complete coverage
const text1 = 'The primary colors are red, blue, and yellow.';
const reference1 = 'The primary colors are red, blue, and yellow.';

console.log('Example 1 - Complete Coverage:');
console.log('Text:', text1);
console.log('Reference:', reference1);

const result1 = await metric.measure(reference1, text1);
console.log('Metric Result:', {
  score: result1.score,
  info: {
    missingElements: result1.info.missingElements,
    elementCounts: result1.info.elementCounts,
  },
});

// Example 2: Partial coverage
const text2 = 'The primary colors are red and blue.';
const reference2 = 'The primary colors are red, blue, and yellow.';

console.log('Example 2 - Partial Coverage:');
console.log('Text:', text2);
console.log('Reference:', reference2);

const result2 = await metric.measure(reference2, text2);
console.log('Metric Result:', {
  score: result2.score,
  info: {
    missingElements: result2.info.missingElements,
    elementCounts: result2.info.elementCounts,
  },
});

// Example 3: Minimal coverage
const text3 = 'The seasons include summer.';
const reference3 = 'The four seasons are spring, summer, fall, and winter.';

console.log('Example 3 - Minimal Coverage:');
console.log('xt:', text3);
console.log('Reference:', reference3);

const result3 = await metric.measure(reference3, text3);
console.log('Metric Result:', {
  score: result3.score,
  info: {
    missingElements: result3.info.missingElements,
    elementCounts: result3.info.elementCounts,
  },
});

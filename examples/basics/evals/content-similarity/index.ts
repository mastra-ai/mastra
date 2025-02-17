import { ContentSimilarityMetric } from '@mastra/evals/nlp';

// Configure the metric
const metric = new ContentSimilarityMetric();

// Example 1: High similarity
const text1 = 'The quick brown fox jumps over the lazy dog.';
const reference1 = 'A quick brown fox jumped over a lazy dog.';

console.log('Example 1 - High Similarity:');
console.log('Text:', text1);
console.log('Reference:', reference1);

const result1 = await metric.measure(reference1, text1);
console.log('Metric Result:', {
  score: result1.score,
  info: {
    similarity: result1.info.similarity,
  },
});

// Example 2: Moderate similarity
const text2 = 'A brown fox quickly leaps across a sleeping dog.';
const reference2 = 'The quick brown fox jumps over the lazy dog.';

console.log('Example 2 - Moderate Similarity:');
console.log('Text:', text2);
console.log('Reference:', reference2);

const result2 = await metric.measure(reference2, text2);
console.log('Metric Result:', {
  score: result2.score,
  info: {
    similarity: result2.info.similarity,
  },
});

// Example 3: Low similarity
const text3 = 'The cat sleeps on the windowsill.';
const reference3 = 'The quick brown fox jumps over the lazy dog.';

console.log('Example 3 - Low Similarity:');
console.log('Text:', text3);
console.log('Reference:', reference3);

const result3 = await metric.measure(reference3, text3);
console.log('Metric Result:', {
  score: result3.score,
  info: {
    similarity: result3.info.similarity,
  },
});

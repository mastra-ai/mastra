import { TextualDifferenceMetric } from '@mastra/evals/nlp';

// Configure the metric
const metric = new TextualDifferenceMetric();

// Example 1: Identical texts
const input1 = 'The quick brown fox jumps over the lazy dog';
const output1 = 'The quick brown fox jumps over the lazy dog';

console.log('Example 1 - Identical Texts:');
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  info: {
    confidence: result1.info.confidence,
    ratio: result1.info.ratio,
    changes: result1.info.changes,
    lengthDiff: result1.info.lengthDiff,
  },
});

// Example 2: Minor differences
const input2 = 'Hello world! How are you?';
const output2 = 'Hello there! How is it going?';

console.log('Example 2 - Minor Differences:');
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  info: {
    confidence: result2.info.confidence,
    ratio: result2.info.ratio,
    changes: result2.info.changes,
    lengthDiff: result2.info.lengthDiff,
  },
});

// Example 3: Major differences
const input3 = 'Python is a high-level programming language';
const output3 = 'JavaScript is used for web development';

console.log('Example 3 - Major Differences:');
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  info: {
    confidence: result3.info.confidence,
    ratio: result3.info.ratio,
    changes: result3.info.changes,
    lengthDiff: result3.info.lengthDiff,
  },
});

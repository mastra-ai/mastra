import { KeywordCoverageMetric } from './src/mastra/evals/keyword-custom';

// Example 1: Perfect keyword coverage
const keywords1 = ['healthy', 'nutritious', 'balanced', 'vegetables'];
const metric1 = new KeywordCoverageMetric(keywords1);

const input1 = 'I want a healthy meal suggestion';
const output1 = "Here's a healthy, nutritious and balanced meal plan with lots of vegetables.";

console.log('Example 1 - Perfect Coverage:');
console.log('Keywords:', keywords1);
console.log('Input:', input1);
console.log('Output:', output1);

const result1 = await metric1.measure(input1, output1);
console.log('Metric Result:', {
  score: result1.score,
  matched: result1.info.matchedKeywords,
  total: result1.info.totalKeywords,
});

// Example 2: Mixed keyword coverage
const keywords2 = ['protein', 'carbs', 'fats', 'vitamins'];
const metric2 = new KeywordCoverageMetric(keywords2);

const input2 = 'What nutrients should I include in my diet?';
const output2 = 'Make sure to get enough protein and carbs in your meals.';

console.log('\nExample 2 - Mixed Coverage:');
console.log('Keywords:', keywords2);
console.log('Input:', input2);
console.log('Output:', output2);

const result2 = await metric2.measure(input2, output2);
console.log('Metric Result:', {
  score: result2.score,
  matched: result2.info.matchedKeywords,
  total: result2.info.totalKeywords,
});

// Example 3: No coverage (no keywords present)
const keywords3 = ['exercise', 'workout', 'fitness', 'training'];
const metric3 = new KeywordCoverageMetric(keywords3);

const input3 = 'What should I eat for breakfast?';
const output3 = 'A bowl of cereal with milk is a quick option.';

console.log('Example 3 - No Coverage:');
console.log('Keywords:', keywords3);
console.log('Input:', input3);
console.log('Output:', output3);

const result3 = await metric3.measure(input3, output3);
console.log('Metric Result:', {
  score: result3.score,
  matched: result3.info.matchedKeywords,
  total: result3.info.totalKeywords,
});

import { openai } from '@ai-sdk/openai';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

// Configure the metric
const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'), {
  uncertaintyWeight: 0.3, // Weight for 'unsure' verdicts
  scale: 1, // Scale for the final score
});

// Example 1: High relevancy
const query1 = 'What are the health benefits of regular exercise?';
const response1 =
  'Regular exercise improves cardiovascular health, strengthens muscles, boosts metabolism, and enhances mental well-being through the release of endorphins.';

console.log('\nExample 1 - High Relevancy:');
console.log('Query:', query1);
console.log('Response:', response1);

const result1 = await metric.measure(query1, response1);
console.log('Metric Result:', {
  score: result1.score,
  reason: result1.info.reason,
});

// Example 2: Low relevancy
const query2 = 'What are the benefits of meditation?';
const response2 =
  'The Great Wall of China is over 13,000 miles long and was built during the Ming Dynasty to protect against invasions.';

console.log('\nExample 2 - Low Relevancy:');
console.log('Query:', query2);
console.log('Response:', response2);

const result2 = await metric.measure(query2, response2);
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.info.reason,
});

// Example 3: Partial relevancy
const query3 = 'What should a healthy breakfast include?';
const response3 =
  'A nutritious breakfast should include whole grains and protein. However, the timing of your breakfast is just as important - studies show eating within 2 hours of waking optimizes metabolism and energy levels throughout the day.';

console.log('\nExample 3 - Partial Relevancy:');
console.log('Query:', query3);
console.log('Response:', response3);

const result3 = await metric.measure(query3, response3);
console.log('Metric Result:', {
  score: result3.score,
  reason: result3.info.reason,
});

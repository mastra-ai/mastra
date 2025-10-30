import { openai } from '@ai-sdk/openai';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

// Configure the scorer
const scorer = createAnswerRelevancyScorer({
  model: openai('gpt-4o-mini'),
  options: {
    uncertaintyWeight: 0.3, // Weight for 'unsure' verdicts
    scale: 1, // Scale for the final score
  },
});

// Example 1: High relevancy
const text = 'What are the health benefits of regular exercise?';
const output =
  'Regular exercise improves cardiovascular health, strengthens muscles, boosts metabolism, and enhances mental well-being through the release of endorphins.';

console.log('Example 1 - High Relevancy:');
console.log('Query:', text);
console.log('Response:', output);

const result1 = await scorer.run({
  input: [{ role: 'user', content: text }],
  output: { role: 'assistant', text: output },
});
console.log('Scorer Result:', {
  score: result1.score,
  reason: result1.reason,
});

// Example 2: Partial relevancy
const text2 = 'What should a healthy breakfast include?';
const output2 =
  'A nutritious breakfast should include whole grains and protein. However, the timing of your breakfast is just as important - studies show eating within 2 hours of waking optimizes metabolism and energy levels throughout the day.';

console.log('Example 2 - Partial Relevancy:');
console.log('Query:', text2);
console.log('Response:', output2);

const result2 = await scorer.run({
  input: [{ role: 'user', content: text2 }],
  output: { role: 'assistant', text: output2 },
});
console.log('Metric Result:', {
  score: result2.score,
  reason: result2.reason,
});

// Example 3: Low relevancy
const text3 = 'What are the benefits of meditation?';
const output3 =
  'The Great Wall of China is over 13,000 miles long and was built during the Ming Dynasty to protect against invasions.';

console.log('Example 3 - Low Relevancy:');
console.log('Query:', text3);
console.log('Response:', output3);

const result3 = await scorer.run({
  input: [{ role: 'user', content: text3 }],
  output: { role: 'assistant', text: output3 },
});
console.log('Scorer Result:', {
  score: result3.score,
  reason: result3.reason,
});

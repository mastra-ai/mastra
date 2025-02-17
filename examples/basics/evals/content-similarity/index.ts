import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ContentSimilarityMetric } from '@mastra/evals/nlp';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

// Create the content similarity metric
const metric = new ContentSimilarityMetric({
  ignoreCase: true,
  ignoreWhitespace: true,
});

async function main() {
  // Example 1: High similarity
  const text1 = 'The quick brown fox jumps over the lazy dog.';
  const variation1 = 'A quick brown fox jumped over a lazy dog';

  console.log('\nExample 1 - High Similarity:');
  console.log('Original:', text1);
  console.log('Variation:', variation1);

  const result1 = await metric.measure(text1, variation1);
  console.log('Metric Result:', {
    score: result1.score,
    similarity: result1.info.similarity,
  });

  // Example 2: Low similarity
  const text2 = `
    Machine learning is a branch of artificial intelligence (AI) that enables computers 
    to learn and improve from experience without being explicitly programmed.
  `;
  const variation2 = `
    Data science combines statistics, mathematics, and computer science 
    to extract insights from structured and unstructured data.
  `;

  console.log('\nExample 2 - Low Similarity:');
  console.log('Original:', text2);
  console.log('Variation:', variation2);

  const result2 = await metric.measure(text2, variation2);
  console.log('Metric Result:', {
    score: result2.score,
    similarity: result2.info.similarity,
  });

  // Example 3: Paraphrase detection
  const text3 = 'Regular exercise improves cardiovascular health and boosts energy levels.';
  const query3 = 'What are the benefits of exercise?';
  const response3 = await agent.generate(query3);

  console.log('\nExample 3 - Paraphrase Detection:');
  console.log('Original:', text3);
  console.log('Response:', response3.text);

  const result3 = await metric.measure(text3, response3.text);
  console.log('Metric Result:', {
    score: result3.score,
    similarity: result3.info.similarity,
  });
}

main().catch(console.error);

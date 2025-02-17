import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides concise and relevant answers.',
  model: openai('gpt-4o-mini'),
});

// Create the answer relevancy metric
const metric = new AnswerRelevancyMetric(openai('gpt-4o-mini'), {
  uncertaintyWeight: 0.3, // Weight for 'unsure' verdicts
  scale: 1, // Scale for the final score
});

async function main() {
  // Example 1: High relevancy
  const context1 = `
    The Great Wall of China is over 13,000 miles long.
    Construction began more than 2,000 years ago during the Warring States period.
    It was built to protect Chinese states from nomadic invasions.
  `;
  const query1 = 'What was the purpose of building the Great Wall of China?';
  const response1 = await agent.generate(query1, { context: context1 });

  console.log('\nExample 1 - High Relevancy:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric.measure(context1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Low relevancy
  const context2 = `
    The pyramids of Egypt were built during the Old Kingdom period.
    They served as tombs for pharaohs and their consorts.
    The largest pyramid is the Great Pyramid of Giza.
  `;
  const query2 = 'What materials were used to build the Great Wall of China?';
  const response2 = await agent.generate(query2, { context: context2 });

  console.log('\nExample 2 - Low Relevancy:');
  console.log('Context:', context2);
  console.log('Query:', query2);
  console.log('Response:', response2.text);

  const result2 = await metric.measure(context2, response2.text);
  console.log('Metric Result:', {
    score: result2.score,
    reason: result2.info.reason,
  });
}

main().catch(console.error);

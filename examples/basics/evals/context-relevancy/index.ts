import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ContextRelevancyMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: High relevancy context
  const context1 = [
    'Photosynthesis is a process used by plants to convert light energy into chemical energy.',
    'During photosynthesis, plants absorb carbon dioxide and water.',
    'The process releases oxygen as a byproduct.',
    'Chlorophyll is essential for photosynthesis.',
  ];

  const metric1 = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = 'How do plants produce oxygen?';
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - High Relevancy:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Mixed relevancy context
  const context2 = [
    'The human brain processes visual information through the visual cortex.',
    'The brain contains approximately 86 billion neurons.',
    'Regular exercise improves cognitive function.',
    `The brain requires about 20% of the body's oxygen supply.`,
  ];

  const metric2 = new ContextRelevancyMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'How does the brain process visual information?';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - Mixed Relevancy:');
  console.log('Context:', context2);
  console.log('Query:', query2);
  console.log('Response:', response2.text);

  const result2 = await metric2.measure(query2, response2.text);
  console.log('Metric Result:', {
    score: result2.score,
    reason: result2.info.reason,
  });
}

main().catch(console.error);

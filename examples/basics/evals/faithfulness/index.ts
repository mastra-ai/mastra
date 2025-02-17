import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { FaithfulnessMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: High faithfulness context
  const context1 = [
    'The water cycle consists of evaporation, condensation, and precipitation.',
    'Evaporation occurs when water is heated by the sun.',
    'Condensation forms clouds in the atmosphere.',
    `Precipitation returns water to Earth's surface.`,
  ];

  const metric1 = new FaithfulnessMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = 'Explain the water cycle.';
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - High Faithfulness:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Mixed faithfulness context
  const context2 = [
    'The human digestive system breaks down food into nutrients.',
    'Digestion begins in the mouth with mechanical and chemical breakdown.',
    'The stomach produces acid to help break down food.',
    'Nutrients are absorbed in the small intestine.',
  ];

  const metric2 = new FaithfulnessMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'How does human digestion work?';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - Mixed Faithfulness:');
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

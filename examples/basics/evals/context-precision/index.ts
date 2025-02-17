import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ContextPrecisionMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: High precision context usage
  const context1 = [
    "The Earth's core temperature is approximately 6,000°C.",
    'The core is primarily composed of iron and nickel.',
    "The core creates Earth's magnetic field.",
    'The core is divided into inner and outer regions.',
  ];

  const metric1 = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = "What is Earth's core like?";
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - High Precision:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Mixed precision context usage
  const context2 = [
    'Renewable energy includes solar, wind, and hydroelectric power.',
    'Global energy consumption continues to rise.',
    'Fossil fuels remain a significant energy source.',
    'Energy efficiency measures can reduce consumption.',
  ];

  const metric2 = new ContextPrecisionMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'What are the main renewable energy sources?';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - Mixed Precision:');
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

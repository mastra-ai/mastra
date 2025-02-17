import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { CompletenessMetric } from '@mastra/evals/nlp';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides comprehensive answers.',
  model: openai('gpt-4o-mini'),
});

// Create the completeness metric
const metric = new CompletenessMetric();

async function main() {
  // Example 1: Complete coverage
  const context1 = `
    The solar system consists of:
    - The Sun at the center
    - Eight planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune)
    - Various moons orbiting the planets
    - Asteroids and comets
  `;
  const query1 = 'List all the planets in our solar system.';
  const response1 = await agent.generate(query1, { context: context1 });

  console.log('\nExample 1 - Complete Coverage:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric.measure(context1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    info: {
      missingElements: result1.info.missingElements,
      elementCounts: result1.info.elementCounts,
    },
  });

  // Example 2: Partial coverage
  const context2 = `
    A balanced breakfast should include:
    1. Protein (eggs, yogurt, or lean meat)
    2. Complex carbohydrates (whole grain bread or oatmeal)
    3. Fruits or vegetables
    4. Healthy fats (avocado or nuts)
    5. Hydration (water or unsweetened beverages)
  `;
  const query2 = 'What should I eat for breakfast?';
  const response2 = await agent.generate(query2, { context: context2 });

  console.log('\nExample 2 - Partial Coverage:');
  console.log('Context:', context2);
  console.log('Query:', query2);
  console.log('Response:', response2.text);

  const result2 = await metric.measure(context2, response2.text);
  console.log('Metric Result:', {
    score: result2.score,
    info: {
      missingElements: result2.info.missingElements,
      elementCounts: result2.info.elementCounts,
    },
  });
}

main().catch(console.error);

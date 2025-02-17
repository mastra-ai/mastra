import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { HallucinationMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: Low hallucination context
  const context1 = [
    'The Eiffel Tower is 324 meters tall.',
    'It was completed in 1889.',
    'The tower was built for the World Fair in Paris.',
    'Gustave Eiffel designed the tower.',
  ];

  const metric1 = new HallucinationMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = 'Tell me about the Eiffel Tower.';
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - Low Hallucination:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: High hallucination context
  const context2 = [
    'Quantum computers use qubits instead of classical bits.',
    'Quantum entanglement is a key quantum phenomenon.',
    'Quantum superposition allows multiple states simultaneously.',
  ];

  const metric2 = new HallucinationMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'Explain how quantum computers work.';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - High Hallucination Risk:');
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

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ContextualRecallMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: High recall context
  const context1 = [
    'The Great Wall of China was built over 2,000 years.',
    'The wall spans approximately 13,171 miles.',
    'Construction began during the 7th century BCE.',
    'Multiple dynasties contributed to its construction.',
  ];

  const metric1 = new ContextualRecallMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = 'Tell me about the Great Wall of China.';
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - High Recall:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Partial recall context
  const context2 = [
    'DNA (deoxyribonucleic acid) is a molecule that carries genetic information.',
    'DNA has a double helix structure.',
    'It contains four nucleotide bases: A, T, C, and G.',
    'DNA replication is essential for cell division.',
  ];

  const metric2 = new ContextualRecallMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'What is DNA and what does it do?';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - Partial Recall:');
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

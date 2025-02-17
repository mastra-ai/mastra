import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ContextPositionMetric } from '@mastra/evals/llm';

// Create an agent that will generate responses
const agent = new Agent({
  name: 'Example Agent',
  instructions: 'You are a helpful assistant that provides informative answers.',
  model: openai('gpt-4o-mini'),
});

async function main() {
  // Example 1: Sequential context usage
  const context1 = [
    'Ancient Rome was founded in 753 BCE.',
    'The Roman Republic was established in 509 BCE.',
    'Julius Caesar became dictator in 49 BCE.',
    'The Roman Empire began with Augustus in 27 BCE.',
  ];

  const metric1 = new ContextPositionMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context1,
  });

  const query1 = 'Describe the chronological development of Rome.';
  const response1 = await agent.generate(query1, { context: context1.join(' ') });

  console.log('\nExample 1 - Sequential Context:');
  console.log('Context:', context1);
  console.log('Query:', query1);
  console.log('Response:', response1.text);

  const result1 = await metric1.measure(query1, response1.text);
  console.log('Metric Result:', {
    score: result1.score,
    reason: result1.info.reason,
  });

  // Example 2: Non-sequential context usage
  const context2 = [
    'Python is known for its readability.',
    'JavaScript is widely used in web development.',
    'Java is popular in enterprise applications.',
    'Ruby emphasizes programmer happiness.',
  ];

  const metric2 = new ContextPositionMetric(openai('gpt-4o-mini'), {
    scale: 1,
    context: context2,
  });

  const query2 = 'Compare different programming languages.';
  const response2 = await agent.generate(query2, { context: context2.join(' ') });

  console.log('\nExample 2 - Non-sequential Context:');
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

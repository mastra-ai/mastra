import { openai } from '@ai-sdk/openai';
import { PromptAlignmentMetric } from '@mastra/evals/llm';

async function main() {
  // Example 1: High Alignment - Weather Report
  console.log('Example 1: High Alignment - Weather Report');
  console.log('----------------------------------------');

  const weatherInstructions = ['Use complete sentences', 'Include temperature in Celsius', 'Mention wind conditions'];

  const weatherMetric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
    instructions: weatherInstructions,
  });

  const weatherQuery = 'What is the weather like?';
  const weatherResponse = 'The temperature is 22 degrees Celsius today. A gentle breeze is blowing from the north.';

  console.log('Instructions:', weatherInstructions);
  console.log('Query:', weatherQuery);
  console.log('Response:', weatherResponse);

  const weatherResult = await weatherMetric.measure(weatherQuery, weatherResponse);
  console.log('Result:', {
    score: weatherResult.score,
    reason: weatherResult.info.reason,
    details: weatherResult.info.scoreDetails,
  });

  // Example 2: Mixed Alignment - Product Listing
  console.log('Example 2: Mixed Alignment - Product Listing');
  console.log('-------------------------------------------');

  const productInstructions = [
    'Use bullet points for each item',
    'Include prices in USD format ($X.XX)',
    'Show availability status for each item',
  ];

  const productMetric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
    instructions: productInstructions,
  });

  const productQuery = 'List the available products';
  const productResponse = '• Coffee - $4.99 (In Stock)\n• Tea - $3.99\n• Water - $1.99 (In Stock)';

  console.log('Instructions:', productInstructions);
  console.log('Query:', productQuery);
  console.log('Response:', productResponse);

  const productResult = await productMetric.measure(productQuery, productResponse);
  console.log('Result:', {
    score: productResult.score,
    reason: productResult.info.reason,
    details: productResult.info.scoreDetails,
  });

  // Example 3: N/A Instructions - Weather with Banking Instructions
  console.log('Example 3: N/A Instructions - Weather with Banking Instructions');
  console.log('--------------------------------------------------------');

  const bankingInstructions = ['Show account balance', 'List recent transactions', 'Use proper English'];

  const bankingMetric = new PromptAlignmentMetric(openai('gpt-4o-mini'), {
    instructions: bankingInstructions,
  });

  const weatherQuery2 = 'What is the weather like?';
  const weatherResponse2 = 'It is sunny and warm outside.';

  console.log('Instructions:', bankingInstructions);
  console.log('Query:', weatherQuery2);
  console.log('Response:', weatherResponse2);

  const bankingResult = await bankingMetric.measure(weatherQuery2, weatherResponse2);
  console.log('Result:', {
    score: bankingResult.score,
    reason: bankingResult.info.reason,
    details: bankingResult.info.scoreDetails,
  });
}

main().catch(console.error);

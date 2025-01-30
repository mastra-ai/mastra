import { Mastra } from '@mastra/core';
import type { ModelConfig } from '@mastra/core/llm';

async function main() {
  // Configure your model

  const mastra = new Mastra();

  const modelConfig: ModelConfig = {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  };

  const llm = mastra.LLM(modelConfig);

  const response = await llm.generate('What is machine learning?');

  console.log(response.text);

  const response2 = await llm.generate(['What is machine learning?', 'I love machine learning']);

  console.log(response2.text);

  // Streaming responses
  const stream = await llm.stream(
    [
      {
        role: 'system',
        content: 'You are a helpful assistant',
      },
      {
        role: 'user',
        content: 'Explain quantum computing',
      },
    ],
    {
      onStepFinish: step => {
        console.log('Step completed:', step);
      },
      maxSteps: 3,
    },
  );

  // Handle the stream
  for await (const chunk of stream.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }
}

main();

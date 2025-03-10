import { input } from '@inquirer/prompts';
import { mastra } from './mastra';

const network = mastra.getNetwork('researchNetwork');

async function main() {
  const topic = await input({
    message: 'What topic would you like to research?',
  });

  const result = await network.stream(topic, {
    maxSteps: 20,
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  console.log(network.getState()?.state.toObject());
}

main();

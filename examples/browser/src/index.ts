import { z } from 'zod';
import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('scrapingAgent');

  const result = await agent.generate(
    `Go to https://news.ycombinator.com/, search for Mastra, hit enter and read the title of the first result.`,
    {
      maxSteps: 10,
      experimental_output: z.object({
        title: z.string(),
      }),
    },
  );

  console.log(result.object);
  console.log('done');
}

main();

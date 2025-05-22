import { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

async function main() {
  const crawlWebpage = createTool({
    id: 'Crawl Webpage',
    description: 'Crawls a webpage and extracts the text content',
    inputSchema: z.object({
      url: z.string().url(),
    }),
    outputSchema: z.object({
      rawText: z.string(),
    }),
    execute: async ({ context: { url } }) => {
      return { rawText: 'This is the text content of the webpage' };
    },
  });

  const contentWorkflow = new LegacyWorkflow({ name: 'content-review' });

  contentWorkflow.step(crawlWebpage).commit();

  const { runId, start } = contentWorkflow.createRun();

  console.log('Run', runId);

  const res = await start();

  console.log(res.results);
}

main();

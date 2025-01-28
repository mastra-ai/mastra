import { createTool } from '@mastra/core';
import { z } from 'zod';

import { firecrawl } from '../integrations';

export const crawl = createTool({
  id: 'crawler',
  name: 'Crawler Tool',
  description: 'Crawler Tool to crawl a website and return the content',
  inputSchema: z.object({
    url: z.string(),
    limit: z.number().default(3),
    pathRegex: z.string().nullable(),
  }),
  outputSchema: z.object({
    message: z.string(),
    crawlData: z.any(),
  }),
  execute: async ({ context }) => {
    const crawlData = firecrawl.getWorkflows({})?.['FIRECRAWL:CRAWL_AND_SYNC']?.createRun();

    await crawlData?.start({
      triggerData: context,
    });

    return {
      message: 'The website has been successfully crawled and chunks have been synced to the database. Finish.',
      crawlData,
    };
  },
});

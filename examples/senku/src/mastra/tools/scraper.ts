import { createTool } from '@mastra/core';
import { z } from 'zod';

interface ArticleContent {
  title: string;
  description: string;
  author?: string;
  date?: string;
  mainContent: string;
  url: string;
}

export const scrapeWebsiteTool = createTool({
  id: 'scrape-website',
  description: 'Scrape content from a website URL',
  inputSchema: z.object({
    url: z.string().describe('The URL to scrape'),
  }),
  outputSchema: z.object({
    title: z.string(),
    content: z.string(),
    url: z.string(),
  }),
  execute: async ({ context }) => {
    return await scrapeWebsite(context.url);
  },
});

async function scrapeWebsite(url: string) {
  const response = await fetch(url);
  const html = await response.text();

  const title = html.match(/<title>(.*?)<\/title>/)?.[1] || '';

  const withoutScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const withoutStyles = withoutScripts.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  const content = withoutStyles
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    content,
    url,
  };
}

import { createTool } from '@mastra/core/tools';
import type { ScrapeOptions } from 'firecrawl';
import { z } from 'zod';

import { createLazyFirecrawlClient } from './client.js';
import type { FirecrawlClientOptions } from './client.js';
import { documentSchema, scrapeFormatSchema, toDocumentOutput } from './schemas.js';

const inputSchema = z.object({
  url: z.string().url().describe('The URL to scrape.'),
  formats: z
    .array(scrapeFormatSchema)
    .min(1)
    .optional()
    .describe('Content formats to return. Defaults to ["markdown"].'),
  onlyMainContent: z
    .boolean()
    .optional()
    .describe('Return only the main content of the page, excluding headers, navs, footers, etc. Defaults to true.'),
  includeTags: z.array(z.string().min(1)).optional().describe('HTML tags, classes or ids to include.'),
  excludeTags: z.array(z.string().min(1)).optional().describe('HTML tags, classes or ids to exclude.'),
  waitFor: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Milliseconds to wait for the page to load before scraping.'),
  timeout: z.number().int().positive().optional().describe('Request timeout in milliseconds.'),
  maxAge: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Return a cached version if it is younger than this many milliseconds.'),
  mobile: z.boolean().optional().describe('Emulate a mobile device.'),
});

const outputSchema = documentSchema;

type ScrapeInput = z.infer<typeof inputSchema>;

export function toScrapeOptions(input: Omit<ScrapeInput, 'url'>): ScrapeOptions {
  const options: ScrapeOptions = {
    formats: input.formats ?? ['markdown'],
  };

  if (input.onlyMainContent !== undefined) options.onlyMainContent = input.onlyMainContent;
  if (input.includeTags !== undefined) options.includeTags = input.includeTags;
  if (input.excludeTags !== undefined) options.excludeTags = input.excludeTags;
  if (input.waitFor !== undefined) options.waitFor = input.waitFor;
  if (input.timeout !== undefined) options.timeout = input.timeout;
  if (input.maxAge !== undefined) options.maxAge = input.maxAge;
  if (input.mobile !== undefined) options.mobile = input.mobile;

  return options;
}

export function createFirecrawlScrapeTool(config?: FirecrawlClientOptions) {
  const getClient = createLazyFirecrawlClient(config);

  return createTool({
    id: 'firecrawl-scrape',
    description:
      'Scrape a single URL with Firecrawl. Returns the page as clean markdown by default, with optional HTML, links, and summary formats.',
    inputSchema,
    outputSchema,
    execute: async ({ url, ...options }) => {
      const document = await getClient().scrape(url, toScrapeOptions(options));
      return toDocumentOutput(document);
    },
  });
}

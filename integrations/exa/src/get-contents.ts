import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getExaClient } from './client.js';
import type { ExaClient, ExaClientOptions } from './client.js';

const inputSchema = z.object({
  urls: z.array(z.string()).min(1).describe('URLs to fetch content for'),
  text: z
    .union([
      z.boolean(),
      z.object({
        maxCharacters: z.number().optional(),
        includeHtmlTags: z.boolean().optional(),
      }),
    ])
    .optional()
    .describe('Include full page text. Pass true for default, or an object to limit characters / include HTML tags.'),
  highlights: z
    .union([
      z.boolean(),
      z.object({
        numSentences: z.number().optional(),
        highlightsPerUrl: z.number().optional(),
        query: z.string().optional(),
      }),
    ])
    .optional()
    .describe('Include relevant text highlights, optionally focused by a query'),
  summary: z
    .union([
      z.boolean(),
      z.object({
        query: z.string().optional(),
      }),
    ])
    .optional()
    .describe('Include an LLM-generated summary of the page'),
  livecrawl: z
    .enum(['never', 'fallback', 'always', 'auto', 'preferred'])
    .optional()
    .describe('Control whether Exa fetches a fresh copy of the page at request time'),
  livecrawlTimeout: z.number().optional().describe('Live-crawl timeout in milliseconds (default 10000)'),
  subpages: z.number().optional().describe('Number of subpages to crawl per URL (default 0)'),
  subpageTarget: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Topical hint for subpage crawling, e.g. "pricing" or ["docs", "api"]'),
});

const resultSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
  text: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

const outputSchema = z.object({
  requestId: z.string().optional(),
  results: z.array(resultSchema),
  costDollars: z
    .object({
      total: z.number(),
    })
    .passthrough()
    .optional(),
});

type ExaGetContentsOptions = Parameters<ExaClient['getContents']>[1];

export function createExaGetContentsTool(config?: ExaClientOptions) {
  let client: ExaClient | null = null;

  function getClient(): ExaClient {
    if (!client) {
      client = getExaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'exa-get-contents',
    description:
      'Retrieve full text, highlights, and/or LLM summaries for a list of URLs using Exa AI. Useful for hydrating search results with content or scraping known pages. Combine with exa-search for retrieval-augmented generation.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const exa = getClient();

      const options = {
        text: input.text,
        highlights: input.highlights,
        summary: input.summary,
        livecrawl: input.livecrawl,
        livecrawlTimeout: input.livecrawlTimeout,
        subpages: input.subpages,
        subpageTarget: input.subpageTarget,
      } as unknown as ExaGetContentsOptions;

      const response = await exa.getContents(input.urls, options);

      return {
        requestId: response.requestId,
        results: (response.results ?? []).map((r: any) => ({
          id: r.id,
          url: r.url,
          title: r.title ?? null,
          publishedDate: r.publishedDate || undefined,
          author: r.author || undefined,
          image: r.image || undefined,
          favicon: r.favicon || undefined,
          text: r.text || undefined,
          highlights: r.highlights || undefined,
          summary: r.summary || undefined,
        })),
        costDollars: response.costDollars,
      };
    },
  });
}

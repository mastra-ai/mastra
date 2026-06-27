import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getSofyaClient } from './client.js';
import type { SofyaClient, SofyaClientOptions } from './client.js';

const inputSchema = z.object({
  urls: z.array(z.string()).min(1).max(10).describe('URLs to fetch as clean markdown (1-10). Supports web pages, PDFs, and documents'),
  includeRawHtml: z.boolean().optional().describe('Include the raw HTML source for each result'),
});

const outputSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().optional(),
      url: z.string(),
      content: z.string(),
      rawHtml: z.string().optional(),
      publishedTime: z.string().optional(),
      success: z.boolean(),
      error: z.string().optional(),
    }),
  ),
  creditsUsed: z.number(),
  creditsRemaining: z.number(),
});

export function createSofyaFetchTool(config?: SofyaClientOptions) {
  let client: SofyaClient | null = null;

  function getClient(): SofyaClient {
    if (!client) {
      client = getSofyaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'sofya-fetch',
    description:
      'Fetch one or more URLs as clean markdown using Sofya. Supports web pages, PDFs, and documents, using 250+ site-specific parsers. Returns content per URL with a success flag, so partial failures do not fail the whole request.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const response = await getClient().fetch({
        urls: input.urls,
        includeRawHtml: input.includeRawHtml,
      });

      return {
        results: (response.results ?? []).map(r => ({
          title: r.title || undefined,
          url: r.url,
          content: r.content,
          rawHtml: r.raw_html || undefined,
          publishedTime: r.published_time || undefined,
          success: r.success,
          error: r.error || undefined,
        })),
        creditsUsed: response.credits_used,
        creditsRemaining: response.credits_remaining,
      };
    },
  });
}

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { keenableFetchRequest, toIsoDate } from './client.js';
import type { KeenableClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().url().describe('The URL of the page to read.'),
  maxChars: z.number().int().positive().optional().describe('Maximum number of characters of page content to return.'),
});

const outputSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string(),
  publishedAt: z.string().optional(),
});

/**
 * Creates a tool that reads a web page through the Keenable Fetch API and
 * returns its main content as Markdown. Works without an API key.
 *
 * @see https://docs.keenable.ai/api-reference
 */
export function createKeenableFetchTool(config?: KeenableClientOptions) {
  return createTool({
    id: 'keenable-fetch',
    description:
      'Read a web page using the Keenable Fetch API. Returns the main content as Markdown with the page title and publication date when known. Use it to read a page found with search.',
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const response = await keenableFetchRequest({ url: input.url, max_chars: input.maxChars }, config, {
        signal: context?.abortSignal,
      });

      return {
        url: response.url || input.url,
        title: response.title || undefined,
        content: response.content ?? '',
        publishedAt: toIsoDate(response.published_at),
      };
    },
  });
}

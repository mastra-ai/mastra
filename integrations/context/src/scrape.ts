import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getContextClient } from './client.js';
import type { ContextClient, ContextClientOptions } from './client.js';

const inputSchema = z.object({
  url: z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .describe('HTTP or HTTPS URL of the page to scrape'),
  mainContentOnly: z.boolean().optional().describe('Exclude navigation, headers, and footers (default: true)'),
  maxAgeMs: z
    .number()
    .int()
    .min(0)
    .max(31_536_000_000)
    .optional()
    .describe('Maximum cache age in milliseconds. Omit for the Context.dev default; use 0 to fetch fresh content.'),
});

const outputSchema = z.object({
  url: z.string(),
  markdown: z.string(),
  requestId: z.string(),
  cacheMetadata: z.object({ status: z.enum(['hit', 'miss', 'zdr']), ageMs: z.number() }),
});

export function createContextScrapeTool(config?: ContextClientOptions) {
  let client: ContextClient | undefined;

  return createTool({
    id: 'context-scrape',
    description:
      'Scrape a web page to Markdown using Context.dev. Extracts main content by default. Set maxAgeMs to 0 when fresh content is required.',
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      client ??= getContextClient(config);
      const response = await client.web.scrape(
        {
          url: input.url,
          formats: { markdown: true },
          sharedParams: { mainContentOnly: input.mainContentOnly ?? true },
          maxAgeMs: input.maxAgeMs,
        },
        { signal: context?.abortSignal },
      );

      // A successful HTTP response can still contain a failed Markdown output.
      if (response.markdown.success !== true || !response.markdown.data?.trim()) {
        const code = response.markdown.error_code;
        const detail = code && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? ` Error code: ${code}.` : '';
        throw new Error(`Context.dev did not return Markdown for this page.${detail}`);
      }

      return {
        url: response.url,
        markdown: response.markdown.data,
        requestId: response.request_id,
        cacheMetadata: { status: response.cache_metadata.status, ageMs: response.cache_metadata.age_ms },
      };
    },
  });
}

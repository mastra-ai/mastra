import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getExaClient } from './client.js';
import type { ExaClient, ExaClientOptions } from './client.js';

const inputSchema = z.object({
  url: z.string().describe('The URL to find similar pages for'),
  numResults: z.number().min(1).max(100).optional().describe('Number of similar results (1-100, default 10)'),
  excludeSourceDomain: z
    .boolean()
    .optional()
    .describe('If true, omit pages from the same domain as the input URL'),
  includeDomains: z.array(z.string()).optional().describe('Restrict results to these domains'),
  excludeDomains: z.array(z.string()).optional().describe('Exclude results from these domains'),
  includeText: z.array(z.string()).optional().describe('Strings that must appear in the page text'),
  excludeText: z.array(z.string()).optional().describe('Strings that must not appear in the page text'),
  category: z
    .enum(['company', 'research paper', 'news', 'pdf', 'personal site', 'financial report', 'people'])
    .optional()
    .describe('Restrict results to a single content category'),
  startPublishedDate: z.string().optional().describe('Only return pages published on or after this ISO 8601 date'),
  endPublishedDate: z.string().optional().describe('Only return pages published on or before this ISO 8601 date'),
  startCrawlDate: z.string().optional().describe('Only return pages crawled on or after this ISO 8601 date'),
  endCrawlDate: z.string().optional().describe('Only return pages crawled on or before this ISO 8601 date'),
  text: z
    .union([
      z.boolean(),
      z.object({
        maxCharacters: z.number().optional(),
        includeHtmlTags: z.boolean().optional(),
      }),
    ])
    .optional()
    .describe('Include full page text'),
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
    .describe('Include relevant text highlights for each result'),
  summary: z
    .union([
      z.boolean(),
      z.object({
        query: z.string().optional(),
      }),
    ])
    .optional()
    .describe('Include an LLM-generated summary of each result'),
});

const resultSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  score: z.number().optional(),
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

type ExaFindSimilarOptions = Parameters<ExaClient['findSimilar']>[1];

export function createExaFindSimilarTool(config?: ExaClientOptions) {
  let client: ExaClient | null = null;

  function getClient(): ExaClient {
    if (!client) {
      client = getExaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'exa-find-similar',
    description:
      'Find pages semantically similar to a given URL using Exa AI. Useful for "more like this" discovery, competitor research, or expanding from a known good source. Supports the same content options, domain/text filters, and date ranges as exa-search.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const exa = getClient();

      const contents: Record<string, unknown> = {};
      if (input.text !== undefined) contents.text = input.text;
      if (input.highlights !== undefined) contents.highlights = input.highlights;
      if (input.summary !== undefined) contents.summary = input.summary;

      const options = {
        numResults: input.numResults,
        excludeSourceDomain: input.excludeSourceDomain,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
        includeText: input.includeText,
        excludeText: input.excludeText,
        category: input.category,
        startPublishedDate: input.startPublishedDate,
        endPublishedDate: input.endPublishedDate,
        startCrawlDate: input.startCrawlDate,
        endCrawlDate: input.endCrawlDate,
        ...(Object.keys(contents).length > 0 ? { contents } : {}),
      } as unknown as ExaFindSimilarOptions;

      const response = await exa.findSimilar(input.url, options);

      return {
        requestId: response.requestId,
        results: (response.results ?? []).map((r: any) => ({
          id: r.id,
          url: r.url,
          title: r.title ?? null,
          score: r.score,
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

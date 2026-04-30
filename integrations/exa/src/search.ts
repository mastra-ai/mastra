import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getExaClient } from './client.js';
import type { ExaClient, ExaClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The search query'),
  type: z
    .enum(['auto', 'neural', 'keyword', 'hybrid', 'fast', 'instant'])
    .optional()
    .describe(
      "Search type — 'auto' (default) intelligently picks, 'neural' uses embeddings, 'keyword' is traditional, 'fast'/'instant' optimize for latency",
    ),
  numResults: z.number().min(1).max(100).optional().describe('Number of results to return (1-100, default 10)'),
  includeDomains: z.array(z.string()).optional().describe('Restrict results to these domains'),
  excludeDomains: z.array(z.string()).optional().describe('Exclude results from these domains'),
  includeText: z
    .array(z.string())
    .optional()
    .describe('Strings that must appear in the page text. Currently supports a single string of up to 5 words.'),
  excludeText: z
    .array(z.string())
    .optional()
    .describe('Strings that must not appear in the page text. Currently supports a single string of up to 5 words.'),
  category: z
    .enum(['company', 'research paper', 'news', 'pdf', 'personal site', 'financial report', 'people'])
    .optional()
    .describe('Restrict results to a single content category'),
  startPublishedDate: z
    .string()
    .optional()
    .describe('Only return results published on or after this ISO 8601 date (e.g. 2024-01-01)'),
  endPublishedDate: z.string().optional().describe('Only return results published on or before this ISO 8601 date'),
  startCrawlDate: z.string().optional().describe('Only return results crawled on or after this ISO 8601 date'),
  endCrawlDate: z.string().optional().describe('Only return results crawled on or before this ISO 8601 date'),
  userLocation: z.string().optional().describe('Two-letter ISO country code used to localize results (e.g. "US")'),
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
    .describe('Include relevant text highlights for each result'),
  summary: z
    .union([
      z.boolean(),
      z.object({
        query: z.string().optional(),
      }),
    ])
    .optional()
    .describe('Include an LLM-generated summary of each result, optionally guided by a focus query'),
  livecrawl: z
    .enum(['never', 'fallback', 'always', 'auto', 'preferred'])
    .optional()
    .describe('Control whether Exa fetches a fresh copy of each page at request time'),
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
  resolvedSearchType: z.string().optional(),
  results: z.array(resultSchema),
  costDollars: z
    .object({
      total: z.number(),
    })
    .passthrough()
    .optional(),
});

type ExaSearchOptions = Parameters<ExaClient['search']>[1];

export function createExaSearchTool(config?: ExaClientOptions) {
  let client: ExaClient | null = null;

  function getClient(): ExaClient {
    if (!client) {
      client = getExaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'exa-search',
    description:
      'Search the web using Exa AI. Supports neural and keyword search types with rich content options (text, highlights, LLM-generated summaries), category filters, domain include/exclude lists, text-match filters, date ranges, and live crawling. Returns scored results with optional inline page content.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const exa = getClient();

      const contents: Record<string, unknown> = {};
      if (input.text !== undefined) contents.text = input.text;
      if (input.highlights !== undefined) contents.highlights = input.highlights;
      if (input.summary !== undefined) contents.summary = input.summary;
      if (input.livecrawl !== undefined) contents.livecrawl = input.livecrawl;

      const options = {
        type: input.type,
        numResults: input.numResults,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
        includeText: input.includeText,
        excludeText: input.excludeText,
        category: input.category,
        startPublishedDate: input.startPublishedDate,
        endPublishedDate: input.endPublishedDate,
        startCrawlDate: input.startCrawlDate,
        endCrawlDate: input.endCrawlDate,
        userLocation: input.userLocation,
        ...(Object.keys(contents).length > 0 ? { contents } : {}),
      } as unknown as ExaSearchOptions;

      const response = await exa.search(input.query, options);

      return {
        requestId: response.requestId,
        resolvedSearchType: response.resolvedSearchType,
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

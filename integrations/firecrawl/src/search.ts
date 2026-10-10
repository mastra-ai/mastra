import { createTool } from '@mastra/core/tools';
import type { Document, SearchRequest, SearchResultImages, SearchResultNews, SearchResultWeb } from 'firecrawl';
import { z } from 'zod';

import { createLazyFirecrawlClient } from './client.js';
import type { FirecrawlClientOptions } from './client.js';
import { toDocumentOutput } from './schemas.js';

const inputSchema = z.object({
  query: z.string().min(1).describe('The search query.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results to return (1-100).'),
  sources: z
    .array(z.enum(['web', 'news', 'images']))
    .min(1)
    .optional()
    .describe('Result sources to include. Defaults to ["web"].'),
  categories: z
    .array(z.enum(['github', 'research', 'pdf']))
    .min(1)
    .optional()
    .describe('Restrict results to these content categories.'),
  includeDomains: z.array(z.string().min(1)).optional().describe('Only return results from these domains.'),
  excludeDomains: z.array(z.string().min(1)).optional().describe('Never return results from these domains.'),
  tbs: z
    .string()
    .optional()
    .describe('Time filter, e.g. "qdr:d" (past day), "qdr:w" (past week), "qdr:m" (past month), "qdr:y" (past year).'),
  location: z.string().optional().describe('Geographic location to bias results toward, e.g. "Germany".'),
  timeout: z.number().int().positive().optional().describe('Request timeout in milliseconds.'),
  scrapeContent: z
    .boolean()
    .optional()
    .describe('Scrape each web result and include its markdown content. Slower and uses more credits.'),
});

const webResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  markdown: z.string().optional(),
});

const newsResultSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  date: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
});

const imageResultSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  imageUrl: z.string().optional(),
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
});

const outputSchema = z.object({
  web: z.array(webResultSchema),
  news: z.array(newsResultSchema),
  images: z.array(imageResultSchema),
});

type SearchInput = z.infer<typeof inputSchema>;

function isDocument(result: object): result is Document {
  return 'metadata' in result || 'markdown' in result;
}

export function toSearchRequest(input: SearchInput): SearchRequest {
  const request: SearchRequest = { query: input.query };

  if (input.limit !== undefined) request.limit = input.limit;
  if (input.sources !== undefined) request.sources = input.sources;
  if (input.categories !== undefined) request.categories = input.categories;
  if (input.includeDomains !== undefined) request.includeDomains = input.includeDomains;
  if (input.excludeDomains !== undefined) request.excludeDomains = input.excludeDomains;
  if (input.tbs !== undefined) request.tbs = input.tbs;
  if (input.location !== undefined) request.location = input.location;
  if (input.timeout !== undefined) request.timeout = input.timeout;
  if (input.scrapeContent) request.scrapeOptions = { formats: ['markdown'] };

  return request;
}

function toWebResult(result: SearchResultWeb | Document): z.infer<typeof webResultSchema> {
  if (isDocument(result)) {
    const doc = toDocumentOutput(result);
    return {
      url: doc.url ?? '',
      title: doc.title,
      description: doc.description,
      markdown: doc.markdown,
    };
  }

  return {
    url: result.url,
    title: result.title,
    description: result.description,
    category: result.category,
  };
}

function toNewsResult(result: SearchResultNews | Document): z.infer<typeof newsResultSchema> {
  if (isDocument(result)) {
    const doc = toDocumentOutput(result);
    return { url: doc.url, title: doc.title, snippet: doc.description };
  }

  return {
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    date: result.date,
    imageUrl: result.imageUrl,
    category: result.category,
  };
}

function toImageResult(result: SearchResultImages | Document): z.infer<typeof imageResultSchema> {
  if (isDocument(result)) {
    const doc = toDocumentOutput(result);
    return { url: doc.url, title: doc.title };
  }

  return {
    url: result.url,
    title: result.title,
    imageUrl: result.imageUrl,
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
  };
}

export function createFirecrawlSearchTool(config?: FirecrawlClientOptions) {
  const getClient = createLazyFirecrawlClient(config);

  return createTool({
    id: 'firecrawl-search',
    description:
      'Search the web with Firecrawl. Returns ranked URLs with titles and descriptions, and can optionally scrape each result to markdown.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const { query, ...rest } = toSearchRequest(input);
      const response = await getClient().search(query, rest);

      return {
        web: (response.web ?? []).map(toWebResult),
        news: (response.news ?? []).map(toNewsResult),
        images: (response.images ?? []).map(toImageResult),
      };
    },
  });
}

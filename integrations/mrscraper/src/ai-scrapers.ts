import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MrScraperClientOptions } from './config.js';
import { resolveAppToken } from './config.js';
import { SCRAPERS_AI, SCRAPERS_AI_RERUN, SCRAPERS_AI_RERUN_BULK } from './constants.js';
import { mrScraperPostJson } from './http.js';
import { mrScraperApiResultSchema } from './schemas.js';

const agentSchema = z.enum(['general', 'listing', 'map']);

function appJsonHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    accept: 'application/json',
    'x-api-token': token,
  };
}

const createAiInput = z.object({
  url: z.string().url().describe('Target URL to scrape'),
  message: z
    .string()
    .optional()
    .default('')
    .describe(
      'Natural-language instructions for what to extract (ignored for agent map — use crawl settings instead)',
    ),
  agent: agentSchema.optional().default('general'),
  proxyCountry: z
    .string()
    .optional()
    .describe('Optional ISO country code for proxy egress (general/listing agents)'),
  maxDepth: z.number().int().min(0).max(10).optional().default(2).describe('Map agent: crawl depth from start URL'),
  maxPages: z.number().int().min(1).max(5000).optional().default(50).describe('Map agent: max pages to visit'),
  limit: z.number().int().min(1).max(100_000).optional().default(1000).describe('Map agent: max records extracted'),
  includePatterns: z
    .string()
    .optional()
    .default('')
    .describe("Map agent: URL regex patterns to follow, separated by '||'"),
  excludePatterns: z
    .string()
    .optional()
    .default('')
    .describe("Map agent: URL regex patterns to skip, separated by '||'"),
});

export function createMrscraperCreateAiScraperTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-create-ai-scraper',
    description:
      'Create an AI-powered MrScraper scraper from a URL and natural-language extraction goals, or configure a map crawl (agent map). Returns API payload including scraper id for reruns.',
    inputSchema: createAiInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const agent = input.agent;
      let body: Record<string, unknown>;
      if (agent === 'map') {
        body = {
          url: input.url,
          agent: 'map',
          maxDepth: input.maxDepth,
          maxPages: input.maxPages,
          limit: input.limit,
          includePatterns: input.includePatterns,
          excludePatterns: input.excludePatterns,
        };
      } else {
        body = {
          url: input.url,
          message: input.message,
          agent,
          ...(input.proxyCountry?.trim() ? { proxyCountry: input.proxyCountry.trim() } : {}),
        };
      }
      return mrScraperPostJson(SCRAPERS_AI, body, { headers: appJsonHeaders(token) });
    },
  });
}

const rerunAiInput = z.object({
  scraperId: z.string().min(1).describe('Scraper id returned when the scraper was created'),
  url: z.string().url().describe('URL to run against'),
  maxDepth: z.number().int().min(0).max(10).optional().default(2),
  maxPages: z.number().int().min(1).max(5000).optional().default(50),
  limit: z.number().int().min(1).max(100_000).optional().default(1000),
  includePatterns: z.string().optional().default(''),
  excludePatterns: z.string().optional().default(''),
});

export function createMrscraperRerunAiScraperTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-rerun-ai-scraper',
    description:
      'Rerun an existing AI scraper on a new URL. Crawl fields apply when the scraper was created with the map agent.',
    inputSchema: rerunAiInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const body = {
        scraperId: input.scraperId,
        url: input.url,
        maxDepth: input.maxDepth,
        maxPages: input.maxPages,
        limit: input.limit,
        includePatterns: input.includePatterns,
        excludePatterns: input.excludePatterns,
      };
      return mrScraperPostJson(SCRAPERS_AI_RERUN, body, { headers: appJsonHeaders(token) });
    },
  });
}

const bulkAiInput = z.object({
  scraperId: z.string().min(1),
  urls: z.array(z.string().url()).min(1).describe('Non-empty list of target URLs'),
});

export function createMrscraperBulkRerunAiScraperTool(config?: MrScraperClientOptions) {
  return createTool({
    id: 'mrscraper-bulk-rerun-ai-scraper',
    description: 'Rerun an AI scraper on many URLs in one request (batched API call).',
    inputSchema: bulkAiInput,
    outputSchema: mrScraperApiResultSchema,
    execute: async input => {
      const token = resolveAppToken(config);
      const body = { scraperId: input.scraperId, urls: input.urls };
      return mrScraperPostJson(SCRAPERS_AI_RERUN_BULK, body, { headers: appJsonHeaders(token) });
    },
  });
}

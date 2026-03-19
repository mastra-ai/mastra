import { createTool } from '@mastra/core/tools';
import { tavily } from '@tavily/core';
import { z } from 'zod';

import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';

const MAX_WEB_SEARCH_TOKENS = 2_000;
const MAX_WEB_EXTRACT_TOKENS = 2_000;

const MIN_RELEVANCE_SCORE = 0.25;

// Lazily cached Tavily client — created on first use when the API key is available.
let cachedTavilyClient: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  if (cachedTavilyClient) return cachedTavilyClient;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  cachedTavilyClient = tavily({ apiKey });
  return cachedTavilyClient;
}

/**
 * Check whether a Tavily API key is available in the environment.
 * Used by main.ts to decide whether to include Tavily tools or fall back
 * to Anthropic's native web search.
 */
export function hasTavilyKey(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

export function createWebSearchTool() {
  return createTool({
    id: 'web-search',
    description:
      'Search the web for information. Use this to find documentation, look up error messages, check package APIs, or research any topic. Returns relevant web results with content snippets and optionally images.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      searchDepth: z
        .enum(['basic', 'advanced'])
        .optional()
        .default('basic')
        .describe("Search depth - 'basic' for quick searches, 'advanced' for more thorough results"),
      maxResults: z.number().optional().default(10).describe('Maximum number of results to return'),
      includeImages: z.boolean().optional().default(false).describe('Whether to include related images in results'),
    }),
    execute: async context => {
      const tavilyClient = getTavilyClient();
      if (!tavilyClient) {
        return 'No results (TAVILY_API_KEY not configured)';
      }
      try {
        const response = await tavilyClient.search(context.query, {
          searchDepth: context.searchDepth || 'basic',
          maxResults: context.maxResults || 10,
          includeAnswer: true,
          includeImages: context.includeImages || false,
        });

        const filteredResults = response.results.filter(r => (r.score ?? 1) >= MIN_RELEVANCE_SCORE);

        const parts: string[] = [];

        if (response.answer) {
          parts.push(`Answer: ${response.answer}`);
        }

        for (const r of filteredResults) {
          parts.push(`## ${r.title}\n${r.url}\n${r.content}`);
        }

        const images = (response.images || [])
          .map((img: { url?: string } | string) => (typeof img === 'string' ? img : img.url || ''))
          .filter(Boolean);

        if (images.length > 0) {
          parts.push(`Images:\n${images.join('\n')}`);
        }

        const text = parts.join('\n\n');
        return truncateStringForTokenEstimate(text, MAX_WEB_SEARCH_TOKENS);
      } catch {
        return 'No results';
      }
    },
  });
}

export function createWebExtractTool() {
  return createTool({
    id: 'web-extract',
    description:
      'Extract content from one or more URLs. Use this to read web pages, documentation, articles, or any URL. Returns the raw content in markdown format. You can provide up to 20 URLs at once.',
    inputSchema: z.object({
      urls: z.array(z.string()).min(1).max(20).describe('URLs to extract content from (max 20)'),
      extractDepth: z
        .enum(['basic', 'advanced'])
        .optional()
        .default('basic')
        .describe("Extraction depth - 'basic' for simple text, 'advanced' for JS-rendered pages"),
      includeImages: z.boolean().optional().default(false).describe('Whether to include extracted image URLs'),
    }),
    execute: async context => {
      const tavilyClient = getTavilyClient();
      if (!tavilyClient) {
        return 'Extraction failed (TAVILY_API_KEY not configured)';
      }
      try {
        const response = await tavilyClient.extract(context.urls, {
          extractDepth: context.extractDepth || 'basic',
          includeImages: context.includeImages || false,
        });

        const parts: string[] = [];

        for (const r of (response.results || []) as { url: string; rawContent: string }[]) {
          parts.push(`## ${r.url}\n${r.rawContent}`);
        }

        for (const r of (response.failedResults || []) as { url: string; error: string }[]) {
          parts.push(`## ${r.url}\nError: ${r.error}`);
        }

        const text = parts.join('\n\n');
        return truncateStringForTokenEstimate(text, MAX_WEB_EXTRACT_TOKENS);
      } catch (error) {
        return `Extraction failed: ${String(error)}`;
      }
    },
  });
}

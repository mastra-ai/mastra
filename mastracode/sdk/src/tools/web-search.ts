import { createTool, isValidationError, type ValidationError } from '@mastra/core/tools';
import { createParallelSearchTool, createParallelExtractTool } from '@mastra/parallel';
import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';
import { Firecrawl, type SearchResultWeb } from 'firecrawl';
import { z } from 'zod';

import { loadSettings, type WebSearchProviderSetting } from '../onboarding/settings.js';
import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';

const MAX_WEB_SEARCH_TOKENS = 2_000;
const MAX_WEB_EXTRACT_TOKENS = 2_000;

const MIN_RELEVANCE_SCORE = 0.25;

const parallelWebSearchInputSchema = z.object({
  query: z.string().min(1).describe('The search query'),
});

const firecrawlWebSearchInputSchema = z.object({
  query: z.string().min(1).describe('The search query'),
});

const firecrawlWebExtractInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10).describe('URLs to extract content from (1-10).'),
});

function requireParallelOutput<T>(output: T | ValidationError | void, operation: 'search' | 'extract'): T {
  if (output === undefined) {
    throw new Error(`Parallel ${operation} returned no output`);
  }

  if (isValidationError(output)) {
    throw new Error(output.message);
  }

  return output;
}

/**
 * Check whether a Tavily API key is available in the environment.
 * Used to select model-independent web tools before falling back to
 * model-native web search.
 */
export function hasTavilyKey(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/** Check whether a Parallel API key is available in the environment. */
export function hasParallelKey(): boolean {
  return !!process.env.PARALLEL_API_KEY;
}

/** Check whether a Firecrawl API key is available in the environment. */
export function hasFirecrawlKey(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

function createLazyFirecrawlClient(): () => Firecrawl {
  let client: Firecrawl | undefined;

  return () => {
    client ??= new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    return client;
  };
}

/**
 * Wraps the @mastra/tavily search tool with mastracode-specific behavior:
 * relevance filtering, markdown string formatting, and token truncation.
 * The underlying Tavily tool handles client init, input validation, and the API call.
 */
export function createWebSearchTool() {
  const tavilySearchTool = createTavilySearchTool();

  return createTool({
    id: 'web-search',
    description: tavilySearchTool.description!,
    inputSchema: tavilySearchTool.inputSchema!,
    execute: async (input, context) => {
      const output: any = await tavilySearchTool.execute!(input as any, context as any);

      const parts: string[] = [];

      if (output.answer) {
        parts.push(`Answer: ${output.answer}`);
      }

      const filtered = output.results.filter((r: any) => (r.score ?? 1) >= MIN_RELEVANCE_SCORE);
      for (const r of filtered) {
        parts.push(`## ${r.title}\n${r.url}\n${r.content}`);
      }

      const images = (output.images || []).map((img: any) => img.url).filter(Boolean);
      if (images.length > 0) {
        parts.push(`Images:\n${images.join('\n')}`);
      }

      const text = parts.join('\n\n');
      return truncateStringForTokenEstimate(text, MAX_WEB_SEARCH_TOKENS);
    },
  });
}

/**
 * Wraps the @mastra/tavily extract tool with mastracode-specific behavior:
 * markdown string formatting and token truncation.
 */
export function createWebExtractTool() {
  const tavilyExtractTool = createTavilyExtractTool();

  return createTool({
    id: 'web-extract',
    description: tavilyExtractTool.description!,
    inputSchema: tavilyExtractTool.inputSchema!,
    execute: async (input, context) => {
      const output: any = await tavilyExtractTool.execute!(input as any, context as any);

      const parts: string[] = [];

      for (const r of output.results) {
        parts.push(`## ${r.url}\n${r.rawContent}`);
      }

      for (const r of output.failedResults) {
        parts.push(`## ${r.url}\nError: ${r.error}`);
      }

      const text = parts.join('\n\n');
      return truncateStringForTokenEstimate(text, MAX_WEB_EXTRACT_TOKENS);
    },
  });
}

/**
 * Wraps the @mastra/parallel search tool with Mastra Code's standard tool id,
 * markdown string output, and token truncation.
 */
export function createParallelWebSearchTool() {
  const parallelSearchTool = createParallelSearchTool();

  return createTool({
    id: 'web-search',
    description: parallelSearchTool.description!,
    inputSchema: parallelWebSearchInputSchema,
    execute: async (input, context) => {
      const output = requireParallelOutput(
        await parallelSearchTool.execute!({ searchQueries: [input.query] }, context),
        'search',
      );
      const parts: string[] = [];

      for (const result of output.results) {
        const title = result.title || result.url;
        const excerpts = (result.excerpts || []).filter(Boolean).join('\n');
        parts.push([`## ${title}`, result.url, excerpts].filter(Boolean).join('\n'));
      }

      return truncateStringForTokenEstimate(parts.join('\n\n'), MAX_WEB_SEARCH_TOKENS);
    },
  });
}

/**
 * Wraps the @mastra/parallel extract tool with Mastra Code's standard tool id,
 * markdown string output, and token truncation.
 */
export function createParallelWebExtractTool() {
  const parallelExtractTool = createParallelExtractTool();

  return createTool({
    id: 'web-extract',
    description: parallelExtractTool.description!,
    inputSchema: parallelExtractTool.inputSchema!,
    execute: async (input, context) => {
      const output = requireParallelOutput(await parallelExtractTool.execute!(input, context), 'extract');
      const parts: string[] = [];

      for (const result of output.results) {
        const content = result.fullContent || (result.excerpts || []).filter(Boolean).join('\n');
        parts.push([`## ${result.url}`, content].filter(Boolean).join('\n'));
      }

      for (const error of output.errors) {
        const status = error.httpStatusCode ? ` (${error.httpStatusCode})` : '';
        parts.push([`## ${error.url}`, `Error: ${error.errorType}${status}`, error.content].filter(Boolean).join('\n'));
      }

      return truncateStringForTokenEstimate(parts.join('\n\n'), MAX_WEB_EXTRACT_TOKENS);
    },
  });
}

/**
 * Firecrawl web search with Mastra Code's standard tool id, markdown string
 * output, and token truncation.
 */
export function createFirecrawlWebSearchTool() {
  const getClient = createLazyFirecrawlClient();

  return createTool({
    id: 'web-search',
    description: 'Search the web with Firecrawl. Returns ranked results with titles, URLs, and descriptions.',
    inputSchema: firecrawlWebSearchInputSchema,
    execute: async ({ query }) => {
      const { web } = await getClient().search(query, { sources: ['web'] });

      // Without `scrapeOptions` Firecrawl returns search results, never scraped documents.
      const results = (web ?? []) as SearchResultWeb[];
      const parts = results.map(result =>
        [`## ${result.title || result.url}`, result.url, result.description].filter(Boolean).join('\n'),
      );

      return truncateStringForTokenEstimate(parts.join('\n\n'), MAX_WEB_SEARCH_TOKENS);
    },
  });
}

/**
 * Firecrawl page extraction with Mastra Code's standard tool id, markdown
 * string output, and token truncation. Failed URLs are reported inline so one
 * bad URL does not fail the whole call.
 */
export function createFirecrawlWebExtractTool() {
  const getClient = createLazyFirecrawlClient();

  return createTool({
    id: 'web-extract',
    description: 'Extract the content of web pages as markdown with Firecrawl.',
    inputSchema: firecrawlWebExtractInputSchema,
    execute: async ({ urls }) => {
      const client = getClient();
      const parts = await Promise.all(
        urls.map(async url => {
          try {
            const { markdown } = await client.scrape(url, { formats: ['markdown'] });
            return `## ${url}\n${markdown ?? ''}`;
          } catch (error) {
            return `## ${url}\nError: ${error instanceof Error ? error.message : String(error)}`;
          }
        }),
      );

      return truncateStringForTokenEstimate(parts.join('\n\n'), MAX_WEB_EXTRACT_TOKENS);
    },
  });
}

/**
 * Resolve which model-independent web provider to use. An explicit user
 * preference wins while its API key is configured; otherwise `auto` picks the
 * first configured provider key (Tavily, then Parallel, then Firecrawl).
 */
export function resolveWebSearchProvider(
  preference: WebSearchProviderSetting = 'auto',
): 'tavily' | 'parallel' | 'firecrawl' | undefined {
  if (preference === 'tavily' && hasTavilyKey()) return 'tavily';
  if (preference === 'parallel' && hasParallelKey()) return 'parallel';
  if (preference === 'firecrawl' && hasFirecrawlKey()) return 'firecrawl';

  // `auto`, or an explicit choice whose key is no longer configured.
  if (hasTavilyKey()) return 'tavily';
  if (hasParallelKey()) return 'parallel';
  if (hasFirecrawlKey()) return 'firecrawl';
  return undefined;
}

/**
 * Create the configured model-independent web tools for the provider selected
 * via the `webSearchProvider` preference (set in the TUI settings panel).
 */
export function createConfiguredWebTools() {
  const provider = resolveWebSearchProvider(loadSettings().preferences.webSearchProvider);

  if (provider === 'parallel') {
    return {
      web_search: createParallelWebSearchTool(),
      web_extract: createParallelWebExtractTool(),
    };
  }

  if (provider === 'tavily') {
    return {
      web_search: createWebSearchTool(),
      web_extract: createWebExtractTool(),
    };
  }

  if (provider === 'firecrawl') {
    return {
      web_search: createFirecrawlWebSearchTool(),
      web_extract: createFirecrawlWebExtractTool(),
    };
  }

  return undefined;
}

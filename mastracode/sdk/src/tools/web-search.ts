import { createTool } from '@mastra/core/tools';
import { createParallelSearchTool, createParallelExtractTool } from '@mastra/parallel';
import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';

import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';

const MAX_WEB_SEARCH_TOKENS = 2_000;
const MAX_WEB_EXTRACT_TOKENS = 2_000;

const MIN_RELEVANCE_SCORE = 0.25;

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
    inputSchema: parallelSearchTool.inputSchema!,
    execute: async (input, context) => {
      const output: any = await parallelSearchTool.execute!(input as any, context as any);
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
      const output: any = await parallelExtractTool.execute!(input as any, context as any);
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
 * Create the configured model-independent web tools. Parallel is the primary
 * provider when both provider keys are available.
 */
export function createConfiguredWebTools() {
  if (hasParallelKey()) {
    return {
      web_search: createParallelWebSearchTool(),
      web_extract: createParallelWebExtractTool(),
    };
  }

  if (hasTavilyKey()) {
    return {
      web_search: createWebSearchTool(),
      web_extract: createWebExtractTool(),
    };
  }

  return undefined;
}

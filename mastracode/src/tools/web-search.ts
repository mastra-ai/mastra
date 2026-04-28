import { createTool } from '@mastra/core/tools';
import { createTavilySearchTool, createTavilyExtractTool } from '@mastra/tavily';

import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';

const MAX_WEB_SEARCH_TOKENS = 2_000;
const MAX_WEB_EXTRACT_TOKENS = 2_000;

const MIN_RELEVANCE_SCORE = 0.25;

/**
 * Check whether a Tavily API key is available in the environment.
 * Used by main.ts to decide whether to include Tavily tools or fall back
 * to Anthropic's native web search.
 */
export function hasTavilyKey(): boolean {
  return !!process.env.TAVILY_API_KEY;
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

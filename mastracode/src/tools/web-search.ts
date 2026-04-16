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

export function createWebSearchTool() {
  const tool = createTavilySearchTool();
  const originalExecute = tool.execute!;

  // We override execute to return a truncated string instead of structured data.
  // This is intentional: mastracode needs token-budgeted string output for the model,
  // not the full structured response. Clearing outputSchema so validation doesn't
  // reject the string return, and the cast follows from that type change.
  tool.outputSchema = undefined;

  tool.execute = (async (input: any, context: any) => {
    try {
      const output: any = await originalExecute.call(tool, input, context);

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
    } catch {
      return 'No results';
    }
  }) as unknown as typeof tool.execute;

  return tool;
}

export function createWebExtractTool() {
  const tool = createTavilyExtractTool();
  const originalExecute = tool.execute!;

  // Same pattern as search: override execute to return truncated string output.
  tool.outputSchema = undefined;

  tool.execute = (async (input: any, context: any) => {
    try {
      const output: any = await originalExecute.call(tool, input, context);

      const parts: string[] = [];

      for (const r of output.results) {
        parts.push(`## ${r.url}\n${r.rawContent}`);
      }

      for (const r of output.failedResults) {
        parts.push(`## ${r.url}\nError: ${r.error}`);
      }

      const text = parts.join('\n\n');
      return truncateStringForTokenEstimate(text, MAX_WEB_EXTRACT_TOKENS);
    } catch (error) {
      return `Extraction failed: ${String(error)}`;
    }
  }) as unknown as typeof tool.execute;

  return tool;
}

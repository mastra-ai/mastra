import type { ContextClientOptions } from './client.js';
import { createContextScrapeTool } from './scrape.js';
import { createContextSearchTool } from './search.js';

export function createContextTools(config?: ContextClientOptions) {
  return {
    contextSearch: createContextSearchTool(config),
    contextScrape: createContextScrapeTool(config),
  };
}

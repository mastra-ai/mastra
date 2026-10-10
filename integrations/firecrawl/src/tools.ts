import type { FirecrawlClientOptions } from './client.js';
import { createFirecrawlScrapeTool } from './scrape.js';
import { createFirecrawlSearchTool } from './search.js';

export function createFirecrawlTools(config?: FirecrawlClientOptions) {
  return {
    firecrawlSearch: createFirecrawlSearchTool(config),
    firecrawlScrape: createFirecrawlScrapeTool(config),
  };
}

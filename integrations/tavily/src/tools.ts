import type { TavilyClientOptions } from './client.js';
import { createTavilyCrawlTool } from './crawl.js';
import { createTavilyExtractTool } from './extract.js';
import { createTavilyMapTool } from './map.js';
import { createTavilySearchTool } from './search.js';

export function createTavilyTools(config?: TavilyClientOptions) {
  return {
    tavilySearch: createTavilySearchTool(config),
    tavilyExtract: createTavilyExtractTool(config),
    tavilyCrawl: createTavilyCrawlTool(config),
    tavilyMap: createTavilyMapTool(config),
  };
}

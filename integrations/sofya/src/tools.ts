import type { SofyaClientOptions } from './client.js';
import { createSofyaExtractTool } from './extract.js';
import { createSofyaFetchTool } from './fetch.js';
import { createSofyaResearchTool } from './research.js';
import { createSofyaSearchTool } from './search.js';

export function createSofyaTools(config?: SofyaClientOptions) {
  return {
    sofyaSearch: createSofyaSearchTool(config),
    sofyaFetch: createSofyaFetchTool(config),
    sofyaExtract: createSofyaExtractTool(config),
    sofyaResearch: createSofyaResearchTool(config),
  };
}

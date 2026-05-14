import type { BrightDataClientOptions } from './client.js';
import { createBrightDataFetchTool } from './fetch.js';
import { createBrightDataSearchTool } from './search.js';

export function createBrightDataTools(config?: BrightDataClientOptions) {
  return {
    webSearch: createBrightDataSearchTool(config),
    webFetch: createBrightDataFetchTool(config),
  };
}

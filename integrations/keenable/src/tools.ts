import type { KeenableClientOptions } from './client.js';
import { createKeenableFetchTool } from './fetch.js';
import { createKeenableSearchTool } from './search.js';

export function createKeenableTools(config?: KeenableClientOptions) {
  return {
    keenableSearch: createKeenableSearchTool(config),
    keenableFetch: createKeenableFetchTool(config),
  };
}

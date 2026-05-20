import type { PerplexityClientOptions } from './client.js';
import { createPerplexitySearchTool } from './search.js';

export function createPerplexityTools(config?: PerplexityClientOptions) {
  return {
    perplexitySearch: createPerplexitySearchTool(config),
  };
}

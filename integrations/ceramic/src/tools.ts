import type { CeramicClientOptions } from './client.js';
import { createCeramicSearchTool } from './search.js';

export function createCeramicTools(config?: CeramicClientOptions) {
  return {
    ceramicSearch: createCeramicSearchTool(config),
  };
}

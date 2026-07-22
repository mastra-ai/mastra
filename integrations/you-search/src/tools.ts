import type { YouClientOptions } from './client.js';
import { createYouSearchTool } from './search.js';

export function createYouTools(config?: YouClientOptions) {
  return {
    youSearch: createYouSearchTool(config),
  };
}

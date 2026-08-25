import type { ParallelClientOptions } from './client.js';
import { createParallelExtractTool } from './extract.js';
import { createParallelSearchTool } from './search.js';

export function createParallelTools(config?: ParallelClientOptions) {
  return {
    parallelSearch: createParallelSearchTool(config),
    parallelExtract: createParallelExtractTool(config),
  };
}

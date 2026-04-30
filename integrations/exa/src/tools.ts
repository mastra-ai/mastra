import { createExaAnswerTool } from './answer.js';
import type { ExaClientOptions } from './client.js';
import { createExaFindSimilarTool } from './find-similar.js';
import { createExaGetContentsTool } from './get-contents.js';
import { createExaSearchTool } from './search.js';

export function createExaTools(config?: ExaClientOptions) {
  return {
    exaSearch: createExaSearchTool(config),
    exaFindSimilar: createExaFindSimilarTool(config),
    exaGetContents: createExaGetContentsTool(config),
    exaAnswer: createExaAnswerTool(config),
  };
}

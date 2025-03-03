import { createTool } from '@mastra/core/tools';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { rerank } from '../rerank';
import type { RerankConfig } from '../rerank';
import { vectorQuerySearch, defaultVectorQueryDescription, filterDescription, topKDescription } from '../utils';

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  model,
  enableFilter = false,
  reranker,
  id,
  description,
}: {
  vectorStoreName: string;
  indexName: string;
  model: EmbeddingModel<string>;
  enableFilter?: boolean;
  reranker?: RerankConfig;
  id?: string;
  description?: string;
}): ReturnType<typeof createTool> => {
  const toolId = id || `VectorQuery ${vectorStoreName} ${indexName} Tool`;
  const toolDescription = description || defaultVectorQueryDescription();
  return createTool({
    id: toolId,
    inputSchema: z.object({
      queryText: z.string().describe('The text query to search for in the vector database'),
      topK: z.number().default(10).describe(topKDescription),
      filter: z.string().default('{}').describe(filterDescription),
    }),
    outputSchema: z.object({
      relevantContext: z.any(),
    }),
    description: toolDescription,
    execute: async ({ context: { queryText, topK, filter }, mastra }) => {
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      // Get relevant chunks from the vector database
      if (vectorStore) {
        let queryFilter = {};
        if (enableFilter) {
          queryFilter = filter
            ? (() => {
                try {
                  return JSON.parse(filter);
                } catch {
                  return filter;
                }
              })()
            : filter;
        }
        if (mastra.logger) {
          mastra.logger.debug('Using this filter and topK:', { queryFilter, topK });
        }

        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK,
        });
        if (reranker) {
          const rerankedResults = await rerank(results, queryText, reranker.model, {
            ...reranker.options,
            topK: reranker.options?.topK || topK,
          });
          const relevantChunks = rerankedResults.map(({ result }) => result?.metadata);
          return { relevantContext: relevantChunks };
        }

        const relevantChunks = results.map(result => result?.metadata);

        return {
          relevantContext: relevantChunks,
        };
      }

      return {
        relevantContext: [],
      };
    },
  });
};

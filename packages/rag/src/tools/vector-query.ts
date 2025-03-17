import { createTool } from '@mastra/core/tools';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { rerank } from '../rerank';
import type { RerankConfig } from '../rerank';
import {
  vectorQuerySearch,
  defaultVectorQueryDescription,
  filterDescription,
  topKDescription,
  queryTextDescription,
} from '../utils';

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
  // Create base schema with required fields
  const baseSchema = {
    queryText: z.string().describe(queryTextDescription),
    topK: z.any().describe(topKDescription),
  };
  const inputSchema = enableFilter
    ? z
        .object({
          ...baseSchema,
          filter: z.string().describe(filterDescription),
        })
        .passthrough()
    : z.object(baseSchema).passthrough();
  return createTool({
    id: toolId,
    inputSchema,
    outputSchema: z.object({
      relevantContext: z.any(),
    }),
    description: toolDescription,
    execute: async ({
      context: {
        inputData: { queryText, topK, filter },
      },
      mastra,
    }) => {
      const topKValue =
        typeof topK === 'number' && !isNaN(topK)
          ? topK
          : typeof topK === 'string' && !isNaN(Number(topK))
            ? Number(topK)
            : 10;

      const vectorStore = mastra?.vectors?.[vectorStoreName];

      // Get relevant chunks from the vector database
      if (vectorStore) {
        let queryFilter = {};
        if (enableFilter && filter) {
          queryFilter = (() => {
            try {
              return typeof filter === 'string' ? JSON.parse(filter) : filter;
            } catch (error) {
              // Log the error and use empty object
              if (mastra.logger) {
                mastra.logger.warn('Failed to parse filter as JSON, using empty filter', { filter, error });
              }
              return {};
            }
          })();
        }
        if (mastra.logger) {
          mastra.logger.debug('Using this filter and topK:', { queryFilter, topK: topKValue });
        }

        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK: topKValue,
        });
        if (reranker) {
          const rerankedResults = await rerank(results, queryText, reranker.model, {
            ...reranker.options,
            topK: reranker.options?.topK || topKValue,
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

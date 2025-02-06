import { type EmbeddingOptions } from '@mastra/core/embeddings';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { rerank, RerankConfig } from '../rerank';
import { vectorQuerySearch } from '../utils';

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  options,
  enableFilter = false,
  reranker,
  id,
  description,
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  enableFilter?: boolean;
  reranker?: RerankConfig;
  id?: string;
  description?: string;
}) => {
  const toolId = id || `VectorQuery ${vectorStoreName} ${indexName} Tool`;
  const toolDescription =
    description ||
    `Retrieves relevant information from ${vectorStoreName} using ${indexName} index.

    You MUST generate for each query:
    1. topK: number of results to return
        - Broad queries (overviews, lists): 10-15
        - Specific queries: 3-5

    2. filter: query filter (REQUIRED)
        - Generate a filter that matches the query's keywords and intent
        - Use appropriate operators
        - Must be valid JSON string

    User overrides:
    - If valid topK/filter provided, use those
    - If invalid/missing, you must generate appropriate values`;

  console.log('toolId', toolId);

  return createTool({
    id: toolId,
    inputSchema: z.object({
      queryText: z.string(),
      topK: z.number(),
      filter: z.string(),
    }),
    outputSchema: z.object({
      relevantContext: z.any(),
    }),
    description: toolDescription,
    execute: async ({ context: { queryText, topK, filter }, mastra }) => {
      console.log('queryText', queryText);
      console.log('topK', topK);
      console.log('filter', filter);
      console.log('mastra', mastra);
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      console.log('vectorStore', vectorStore);
      console.log('vectorStoreName', vectorStoreName);

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
          console.log('Generating this filter:', queryFilter);
        }

        console.log('topK', topK);

        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          options,
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

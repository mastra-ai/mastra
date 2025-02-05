import { type EmbeddingOptions } from '@mastra/core/embeddings';
// import { FilterSchemaBuilder } from '@mastra/core/filter';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { rerank, RerankConfig } from '../rerank';
import { vectorQuerySearch } from '../utils';

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
  enableFilter = false,
  reranker,
  id,
  description,
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  topK?: number;
  enableFilter?: boolean;
  reranker?: RerankConfig;
  id?: string;
  description?: string;
}) => {
  // const FilterCondition = FilterSchemaBuilder.createFilterSchema();

  const toolId = id || `VectorQuery ${vectorStoreName} ${indexName} Tool`;
  const toolDescription =
    description ||
    `Fetches and combines the top ${topK} relevant chunks from the ${vectorStoreName} vector store using the ${indexName} index`;

  return createTool({
    id: toolId,
    inputSchema: z.object({
      queryText: z.string().describe('query text'),
      filter: z.string(),
    }),
    outputSchema: z.object({
      relevantContext: z.array(z.any()).describe('relevant context'),
    }),
    description: toolDescription,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      console.log('filter', filter);
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      // Get relevant chunks from the vector database
      if (vectorStore) {
        const queryFilter = enableFilter && filter ? filter : {};
        console.log('queryFilter', queryFilter);
        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          options,
          queryFilter,
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

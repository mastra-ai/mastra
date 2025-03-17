import { createTool } from '@mastra/core/tools';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { GraphRAG } from '../graph-rag';
import {
  vectorQuerySearch,
  defaultGraphRagDescription,
  filterDescription,
  topKDescription,
  queryTextDescription,
} from '../utils';

export const createGraphRAGTool = ({
  vectorStoreName,
  indexName,
  model,
  enableFilter = false,
  graphOptions = {
    dimension: 1536,
    randomWalkSteps: 100,
    restartProb: 0.15,
    threshold: 0.7,
  },
  id,
  description,
}: {
  vectorStoreName: string;
  indexName: string;
  model: EmbeddingModel<string>;
  enableFilter?: boolean;
  graphOptions?: {
    dimension?: number;
    randomWalkSteps?: number;
    restartProb?: number;
    threshold?: number;
  };
  id?: string;
  description?: string;
}): ReturnType<typeof createTool> => {
  const toolId = id || `GraphRAG ${vectorStoreName} ${indexName} Tool`;
  const toolDescription = description || defaultGraphRagDescription();
  // Initialize GraphRAG
  const graphRag = new GraphRAG(graphOptions.dimension, graphOptions.threshold);
  let isInitialized = false;

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
    execute: async ({ context: { queryText, topK, filter }, mastra }) => {
      const topKValue =
        typeof topK === 'number' && !isNaN(topK)
          ? topK
          : typeof topK === 'string' && !isNaN(Number(topK))
            ? Number(topK)
            : 10;
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      if (vectorStore) {
        let queryFilter = {};
        if (enableFilter) {
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
        const { results, queryEmbedding } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK: topKValue,
          includeVectors: true,
        });

        // Initialize graph if not done yet
        if (!isInitialized) {
          // Get all chunks and embeddings for graph construction
          const chunks = results.map(result => ({
            text: result?.metadata?.text,
            metadata: result.metadata ?? {},
          }));
          const embeddings = results.map(result => ({
            vector: result.vector || [],
          }));

          graphRag.createGraph(chunks, embeddings);
          isInitialized = true;
        }

        // Get reranked results using GraphRAG
        const rerankedResults = graphRag.query({
          query: queryEmbedding,
          topK: topKValue,
          randomWalkSteps: graphOptions.randomWalkSteps,
          restartProb: graphOptions.restartProb,
        });

        // Extract and combine relevant chunks
        const relevantChunks = rerankedResults.map(result => result.content);
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

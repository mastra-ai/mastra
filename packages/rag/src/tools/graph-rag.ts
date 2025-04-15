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
    topK: z.coerce.number().describe(topKDescription),
  };
  const inputSchema = enableFilter
    ? z
        .object({
          ...baseSchema,
          filter: z.coerce.string().describe(filterDescription),
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
      const logger = mastra?.getLogger();
      if (!logger) {
        console.warn(
          '[GraphRAGTool] Logger not initialized: no debug or error logs will be recorded for this tool execution.',
        );
      }
      if (logger) {
        logger.debug('[GraphRAGTool] execute called with:', { queryText, topK, filter });
      }
      try {
        const topKValue =
          typeof topK === 'number' && !isNaN(topK)
            ? topK
            : typeof topK === 'string' && !isNaN(Number(topK))
              ? Number(topK)
              : 10;
        const vectorStore = mastra?.getVector(vectorStoreName);

        if (!vectorStore) {
          if (logger) {
            logger.error('Vector store not found', { vectorStoreName });
          }
          return { relevantContext: [] };
        }

        let queryFilter = {};
        if (enableFilter) {
          queryFilter = (() => {
            try {
              return typeof filter === 'string' ? JSON.parse(filter) : filter;
            } catch (error) {
              // Log the error and use empty object
              if (logger) {
                logger.warn('Failed to parse filter as JSON, using empty filter', { filter, error });
              }
              return {};
            }
          })();
        }
        if (logger) {
          logger.debug('Prepared vector query parameters:', { queryFilter, topK: topKValue });
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
        if (logger) {
          logger.debug('vectorQuerySearch returned results', { count: results.length });
        }

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

          if (logger) {
            logger.debug('Initializing graph', { chunkCount: chunks.length, embeddingCount: embeddings.length });
          }
          graphRag.createGraph(chunks, embeddings);
          isInitialized = true;
        } else if (logger) {
          logger.debug('Graph already initialized, skipping graph construction');
        }

        // Get reranked results using GraphRAG
        const rerankedResults = graphRag.query({
          query: queryEmbedding,
          topK: topKValue,
          randomWalkSteps: graphOptions.randomWalkSteps,
          restartProb: graphOptions.restartProb,
        });
        if (logger) {
          logger.debug('GraphRAG query returned results', { count: rerankedResults.length });
        }
        // Extract and combine relevant chunks
        const relevantChunks = rerankedResults.map(result => result.content);
        if (logger) {
          logger.debug('Returning relevant context chunks', { count: relevantChunks.length });
        }
        return {
          relevantContext: relevantChunks,
        };
      } catch (err) {
        if (logger) {
          logger.error('Unexpected error in VectorQueryTool execute', {
            error: err,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
          });
        }
        return { relevantContext: [] };
      }
    },
  });
};

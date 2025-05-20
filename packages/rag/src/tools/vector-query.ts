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
import { convertToSources } from '../utils/convert-sources';

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  model,
  enableFilter = false,
  includeVectors = false,
  includeSources = true,
  reranker,
  id,
  description,
}: {
  vectorStoreName: string;
  indexName: string;
  model: EmbeddingModel<string>;
  enableFilter?: boolean;
  includeVectors?: boolean;
  includeSources?: boolean;
  reranker?: RerankConfig;
  id?: string;
  description?: string;
}) => {
  const toolId = id || `VectorQuery ${vectorStoreName} ${indexName} Tool`;
  const toolDescription = description || defaultVectorQueryDescription();
  // Create base schema with required fields
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
    // Output schema includes `sources`, which exposes the full set of retrieved chunks (QueryResult objects)
    // Each source contains all information needed to reference
    // the original document, chunk, and similarity score.
    outputSchema: z.object({
      // Array of metadata or content for compatibility with prior usage
      relevantContext: z.any(),
      // Array of full retrieval result objects
      sources: z.array(
        z.object({
          id: z.string(), // Unique chunk/document identifier
          metadata: z.any(), // All metadata fields (document ID, etc.)
          vector: z.array(z.number()), // Embedding vector (if available)
          score: z.number(), // Similarity score for this retrieval
          document: z.string(), // Full chunk/document text (if available)
        }),
      ),
    }),
    description: toolDescription,
    execute: async ({ context: { queryText, topK, filter }, mastra }) => {
      const logger = mastra?.getLogger();
      if (!logger) {
        console.warn(
          '[VectorQueryTool] Logger not initialized: no debug or error logs will be recorded for this tool execution.',
        );
      }
      if (logger) {
        logger.debug('[VectorQueryTool] execute called with:', { queryText, topK, filter });
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
          return { relevantContext: [], sources: [] };
        }
        // Get relevant chunks from the vector database
        let queryFilter = {};
        if (enableFilter && filter) {
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
          logger.debug('Prepared vector query parameters', { queryText, topK: topKValue, queryFilter });
        }

        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK: topKValue,
          includeVectors,
        });
        if (logger) {
          logger.debug('vectorQuerySearch returned results', { count: results.length });
        }
        if (reranker) {
          if (logger) {
            logger.debug('Reranking results', { rerankerModel: reranker.model, rerankerOptions: reranker.options });
          }
          const rerankedResults = await rerank(results, queryText, reranker.model, {
            ...reranker.options,
            topK: reranker.options?.topK || topKValue,
          });
          if (logger) {
            logger.debug('Reranking complete', { rerankedCount: rerankedResults.length });
          }
          const relevantChunks = rerankedResults.map(({ result }) => result?.metadata);
          if (logger) {
            logger.debug('Returning reranked relevant context chunks', { count: relevantChunks.length });
          }
          const sources = includeSources ? convertToSources(rerankedResults) : [];
          return { relevantContext: relevantChunks, sources };
        }

        const relevantChunks = results.map(result => result?.metadata);
        if (logger) {
          logger.debug('Returning relevant context chunks', { count: relevantChunks.length });
        }
        // `sources` exposes the full retrieval objects
        const sources = includeSources ? convertToSources(results) : [];
        return {
          relevantContext: relevantChunks,
          sources,
        };
      } catch (err) {
        if (logger) {
          logger.error('Unexpected error in VectorQueryTool execute', {
            error: err,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
          });
        }
        return { relevantContext: [], sources: [] };
      }
    },
  });
};

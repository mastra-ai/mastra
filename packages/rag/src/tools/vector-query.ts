import { createTool } from '@mastra/core/tools';
import type { MastraVector, MastraEmbeddingModel } from '@mastra/core/vector';
import { z } from 'zod';

import { rerank, rerankWithScorer } from '../rerank';
import type { RerankConfig, RerankResult } from '../rerank';
import { vectorQuerySearch, defaultVectorQueryDescription, filterSchema, outputSchema, baseSchema } from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { VectorQueryToolOptions } from './types';

export const createVectorQueryTool = (options: VectorQueryToolOptions) => {
  const { id, description } = options;
  const storeName = options['vectorStoreName'] ? options.vectorStoreName : 'DirectVectorStore';

  const toolId = id || `VectorQuery ${storeName} ${options.indexName} Tool`;
  const toolDescription = description || defaultVectorQueryDescription();
  const inputSchema = options.enableFilter ? filterSchema : z.object(baseSchema).passthrough();

  return createTool({
    id: toolId,
    description: toolDescription,
    inputSchema,
    outputSchema,
    execute: async ({ context, mastra, runtimeContext }) => {
      const indexName: string = runtimeContext.get('indexName') ?? options.indexName;
      const vectorStoreName: string =
        'vectorStore' in options ? storeName : (runtimeContext.get('vectorStoreName') ?? storeName);
      const includeVectors: boolean = runtimeContext.get('includeVectors') ?? options.includeVectors ?? false;
      const includeSources: boolean = runtimeContext.get('includeSources') ?? options.includeSources ?? true;
      const reranker: RerankConfig = runtimeContext.get('reranker') ?? options.reranker;
      const databaseConfig = runtimeContext.get('databaseConfig') ?? options.databaseConfig;
      const model: MastraEmbeddingModel<string> = runtimeContext.get('model') ?? options.model;
      const providerOptions: Record<string, Record<string, any>> | undefined =
        runtimeContext.get('providerOptions') ?? options.providerOptions;

      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`); // won't fire

      const topK: number = runtimeContext.get('topK') ?? context.topK ?? 10;
      const filter: Record<string, any> = runtimeContext.get('filter') ?? context.filter;
      const queryText = context.queryText;
      const enableFilter = !!runtimeContext.get('filter') || (options.enableFilter ?? false);

      const logger = mastra?.getLogger();
      if (!logger) {
        console.warn(
          '[VectorQueryTool] Logger not initialized: no debug or error logs will be recorded for this tool execution.',
        );
      }
      if (logger) {
        logger.debug('[VectorQueryTool] execute called with:', { queryText, topK, filter, databaseConfig });
      }
      try {
        const topKValue =
          typeof topK === 'number' && !isNaN(topK)
            ? topK
            : typeof topK === 'string' && !isNaN(Number(topK))
              ? Number(topK)
              : 10;

        let vectorStore: MastraVector | undefined = undefined;
        if ('vectorStore' in options) {
          vectorStore = options.vectorStore;
        } else if (mastra) {
          vectorStore = mastra.getVector(vectorStoreName);
        }
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
          logger.debug('Prepared vector query parameters', { queryText, topK: topKValue, queryFilter, databaseConfig });
        }

        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK: topKValue,
          includeVectors,
          databaseConfig,
          providerOptions,
        });
        if (logger) {
          logger.debug('vectorQuerySearch returned results', { count: results.length });
        }

        if (reranker) {
          if (logger) {
            logger.debug('Reranking results', { rerankerModel: reranker.model, rerankerOptions: reranker.options });
          }

          let rerankedResults: RerankResult[] = [];

          if (typeof reranker?.model === 'object' && 'getRelevanceScore' in reranker?.model) {
            rerankedResults = await rerankWithScorer({
              results,
              query: queryText,
              scorer: reranker.model,
              options: {
                ...reranker.options,
                topK: reranker.options?.topK || topKValue,
              },
            });
          } else {
            rerankedResults = await rerank(results, queryText, reranker.model, {
              ...reranker.options,
              topK: reranker.options?.topK || topKValue,
            });
          }

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
    // Use any for output schema as the structure of the output causes type inference issues
  }) as RagTool<typeof inputSchema, any>;
};

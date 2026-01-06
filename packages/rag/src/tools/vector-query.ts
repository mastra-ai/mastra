import { createTool } from '@mastra/core/tools';
import type { MastraEmbeddingModel } from '@mastra/core/vector';
import { z } from 'zod';

import { rerank, rerankWithScorer } from '../rerank';
import type { RerankConfig, RerankResult } from '../rerank';
import {
  vectorQuerySearch,
  defaultVectorQueryDescription,
  filterSchema,
  outputSchema,
  baseSchema,
  coerceTopK,
  parseFilterValue,
  resolveVectorStore,
} from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { ProviderOptions, VectorQueryToolOptions } from './types';

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
    execute: async (inputData, context) => {
      const { requestContext, mastra } = context || {};
      const indexName: string = requestContext?.get('indexName') ?? options.indexName;
      const vectorStoreName: string =
        'vectorStore' in options ? storeName : (requestContext?.get('vectorStoreName') ?? storeName);
      const includeVectors: boolean = requestContext?.get('includeVectors') ?? options.includeVectors ?? false;
      const includeSources: boolean = requestContext?.get('includeSources') ?? options.includeSources ?? true;
      const reranker: RerankConfig | undefined = requestContext?.get('reranker') ?? options.reranker;
      const databaseConfig = requestContext?.get('databaseConfig') ?? options.databaseConfig;
      const model: MastraEmbeddingModel<string> = requestContext?.get('model') ?? options.model;
      const providerOptions: ProviderOptions['providerOptions'] =
        requestContext?.get('providerOptions') ?? options.providerOptions;

      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`); // won't fire

      const topK: number = requestContext?.get('topK') ?? inputData.topK ?? 10;
      const filter: Record<string, any> = requestContext?.get('filter') ?? (inputData.filter as Record<string, any>);
      const queryText = inputData.queryText;
      const enableFilter = !!requestContext?.get('filter') || (options.enableFilter ?? false);

      const logger = mastra?.getLogger();
      if (logger) {
        logger.debug('[VectorQueryTool] execute called with:', { queryText, topK, filter, databaseConfig });
      }
      try {
        const topKValue = coerceTopK(topK);

        const vectorStore = await resolveVectorStore(options, { requestContext, mastra, vectorStoreName });
        if (!vectorStore) {
          throw new Error(`Vector store '${vectorStoreName}' not found`);
        }
        // Get relevant chunks from the vector database
        const queryFilter = enableFilter && filter ? parseFilterValue(filter, logger) : {};
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
        throw err;
      }
    },
    // Use any for output schema as the structure of the output causes type inference issues
  }) as RagTool<typeof inputSchema, any>;
};

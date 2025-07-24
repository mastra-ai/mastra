import type { IMastraLogger as MastraLogger } from '@mastra/core/logger';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool } from '@mastra/core/tools';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { rerank, rerankWithScorer } from '../rerank';
import type { RerankConfig, RerankResult } from '../rerank';
import { vectorQuerySearch, defaultVectorQueryDescription, filterSchema, outputSchema, baseSchema } from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { VectorQueryToolOptions } from './types';

/**
 * Resolves option values with priority: runtime context > function option > static option > default
 * Handles both synchronous and asynchronous option resolvers
 */
async function resolveOption<T>(
  key: string,
  runtimeContext: RuntimeContext,
  option: T | ((params: { runtimeContext: RuntimeContext }) => Promise<T> | T) | undefined,
  defaultValue?: T,
  logger?: MastraLogger,
): Promise<T | undefined> {
  // Check runtime context first
  const runtimeValue = runtimeContext.get(key);
  if (runtimeValue !== undefined && runtimeValue !== null) {
    if (logger) {
      logger.warn(
        `[VectorQueryTool] Using runtime context values is deprecated. Use dynamic arguments instead: https://mastra.ai/en/reference/tools/vector-query-tool#example-with-dynamic-arguments`,
      );
    }
    return runtimeValue as T;
  }

  // Handle function options
  if (typeof option === 'function') {
    const fn = option as (params: { runtimeContext: RuntimeContext }) => Promise<T> | T;
    const result = fn({ runtimeContext });
    return result;
  }

  // Return static option value
  return option ?? defaultValue;
}

export const createVectorQueryTool = (options: VectorQueryToolOptions) => {
  const { id, description } = options;

  const toolId = id || `VectorQuery ${options.vectorStoreName} ${options.indexName} Tool`;
  const toolDescription = description || defaultVectorQueryDescription();
  const inputSchema = options.enableFilter ? filterSchema : z.object(baseSchema).passthrough();

  return createTool({
    id: toolId,
    description: toolDescription,
    inputSchema,
    outputSchema,
    execute: async ({ context, mastra, runtimeContext }) => {
      const logger = mastra?.getLogger();
      if (!logger) {
        console.warn(
          '[VectorQueryTool] Logger not initialized: no debug or error logs will be recorded for this tool execution.',
        );
      }

      const indexName = await resolveOption('indexName', runtimeContext, options.indexName, undefined, logger);
      const vectorStoreName = await resolveOption('vectorStoreName', runtimeContext, options.vectorStoreName);
      const includeVectors: boolean =
        (await resolveOption('includeVectors', runtimeContext, options.includeVectors, false, logger)) ?? false;
      const includeSources: boolean =
        (await resolveOption('includeSources', runtimeContext, options.includeSources, true, logger)) ?? true;
      const reranker: RerankConfig | undefined = await resolveOption(
        'reranker',
        runtimeContext,
        options.reranker,
        undefined,
        logger,
      );
      const databaseConfig = await resolveOption(
        'databaseConfig',
        runtimeContext,
        options.databaseConfig,
        undefined,
        logger,
      );
      const model: EmbeddingModel<string> | undefined = await resolveOption(
        'model',
        runtimeContext,
        options.model,
        undefined,
        logger,
      );

      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`);
      if (!model) throw new Error(`model is required, got: ${model}`);

      const topK: number = runtimeContext.get('topK') ?? context.topK ?? 10;
      const filter: Record<string, any> = runtimeContext.get('filter') ?? context.filter;
      const queryText = context.queryText;
      const enableFilter = !!runtimeContext.get('filter') || (options.enableFilter ?? false);

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

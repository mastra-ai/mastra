import { createTool } from '@mastra/core/tools';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { rerank } from '../rerank';
import type { RerankConfig } from '../rerank';
import { vectorQuerySearch, defaultVectorQueryDescription, filterSchema, outputSchema, baseSchema } from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { VectorQueryToolOptions } from './types';

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
      const indexName: string =
        runtimeContext.get('indexName') ??
        (typeof options.indexName === 'function' ? await options.indexName({ runtimeContext }) : options.indexName);
      const vectorStoreName: string =
        runtimeContext.get('vectorStoreName') ??
        (typeof options.vectorStoreName === 'function'
          ? await options.vectorStoreName({ runtimeContext })
          : options.vectorStoreName);
      const includeVectors: boolean =
        runtimeContext.get('includeVectors') ??
        (typeof options.includeVectors === 'function'
          ? await options.includeVectors({ runtimeContext })
          : options.includeVectors) ??
        false;
      const includeSources: boolean =
        runtimeContext.get('includeSources') ??
        (typeof options.includeSources === 'function'
          ? await options.includeSources({ runtimeContext })
          : options.includeSources) ??
        true;
      const reranker: RerankConfig =
        runtimeContext.get('reranker') ??
        (typeof options.reranker === 'function' ? await options.reranker({ runtimeContext }) : options.reranker);
      const databaseConfig =
        runtimeContext.get('databaseConfig') ??
        (typeof options.databaseConfig === 'function'
          ? await options.databaseConfig({ runtimeContext })
          : options.databaseConfig);
      const model: EmbeddingModel<string> =
        runtimeContext.get('model') ??
        (typeof options.model === 'function' ? await options.model({ runtimeContext }) : options.model);

      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`);

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
    // Use any for output schema as the structure of the output causes type inference issues
  }) as RagTool<typeof inputSchema, any>;
};

import type { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { rerank } from '../rerank';
import type { RerankConfig } from '../rerank';
import {
  vectorQuerySearch,
  defaultVectorQueryDescription,
  filterSchema,
  outputSchema,
  baseSchema,
  queryTextDescription,
} from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { VectorQueryToolOptions } from './types';

export const createVectorQueryTool = (options: VectorQueryToolOptions) => {
  const { model, id, description, useRuntimeContext } = options;
  const toolId = id || `VectorQuery Tool`;
  const toolDescription = description || defaultVectorQueryDescription();
  let inputSchema;
  if (!useRuntimeContext) {
    inputSchema = options.enableFilter ? filterSchema : z.object(baseSchema).passthrough();
  } else {
    inputSchema = z.object({
      queryText: z.string().describe(queryTextDescription),
    });
  }

  return createTool({
    id: toolId,
    description: toolDescription,
    inputSchema,
    outputSchema,
    execute: async ({ context, mastra, runtimeContext }) => {
      const {
        indexName,
        vectorStoreName,
        queryText,
        topK,
        filter,
        includeVectors,
        includeSources,
        reranker,
        enableFilter,
      } = getToolParams({
        runtimeContext,
        context,
        options,
      });
      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`);

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
    // Use any for output schema as the structure of the output causes type inference issues
  }) as RagTool<typeof inputSchema, any>;
};

function getToolParams({
  runtimeContext,
  context,
  options,
}: {
  runtimeContext: RuntimeContext;
  context: any;
  options: VectorQueryToolOptions;
}) {
  if (!options.useRuntimeContext) {
    const { queryText, topK, filter } = context;
    // Use static config for store/index, etc.
    return {
      indexName: options.indexName,
      vectorStoreName: options.vectorStoreName,
      queryText,
      topK,
      filter,
      includeVectors: options.includeVectors,
      includeSources: options.includeSources,
      reranker: options.reranker,
      enableFilter: options.enableFilter,
    };
  } else {
    // Get params from runtimeContext
    const { queryText } = context;
    const indexName: string = runtimeContext.get('indexName');
    const vectorStoreName: string = runtimeContext.get('vectorStoreName');
    const topK: number = runtimeContext.get('topK') ?? 10;
    const filter: Record<string, any> = runtimeContext.get('filter') ?? {};
    const includeVectors: boolean = runtimeContext.get('includeVectors') ?? false;
    const includeSources: boolean = runtimeContext.get('includeSources') ?? true;
    const reranker: RerankConfig = runtimeContext.get('reranker');
    return {
      indexName,
      vectorStoreName,
      queryText,
      topK,
      filter,
      includeVectors,
      includeSources,
      reranker,
      enableFilter: Object.keys(filter || {}).length > 0,
    };
  }
}

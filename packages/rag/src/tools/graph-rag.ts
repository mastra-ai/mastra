import type { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { GraphRAG } from '../graph-rag';
import { vectorQuerySearch, defaultGraphRagDescription, filterSchema, outputSchema, baseSchema } from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { GraphRagToolOptions } from './types';
import { defaultGraphOptions } from './types';

/**
 * Resolves option values with priority: runtime context > function option > static option > default
 * Handles both synchronous and asynchronous option resolvers
 */
async function resolveOption<T>(
  runtimeContext: RuntimeContext,
  key: string,
  option: T | ((params: { runtimeContext: RuntimeContext }) => Promise<T> | T) | undefined,
  defaultValue?: T,
): Promise<T | undefined> {
  // Check runtime context first
  const runtimeValue = runtimeContext.get(key);
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return runtimeValue as T;
  }

  // Handle function options
  if (typeof option === 'function') {
    const fn = option as (params: { runtimeContext: RuntimeContext }) => Promise<T> | T;
    const result = fn({ runtimeContext });
    return result instanceof Promise ? await result : result;
  }

  // Return static option value
  return option ?? defaultValue;
}

export const createGraphRAGTool = (options: GraphRagToolOptions) => {
  const { id, description } = options;

  const toolId = id || `GraphRAG Tool`;
  const toolDescription = description || defaultGraphRagDescription();
  const inputSchema = options.enableFilter ? filterSchema : z.object(baseSchema).passthrough();

  return createTool({
    id: toolId,
    inputSchema,
    outputSchema,
    description: toolDescription,
    execute: async ({ context, mastra, runtimeContext }) => {
      // Resolve dynamic options
      const indexName = await resolveOption(runtimeContext, 'indexName', options.indexName);
      const vectorStoreName = await resolveOption(runtimeContext, 'vectorStoreName', options.vectorStoreName);
      const model = await resolveOption(runtimeContext, 'model', options.model);
      const includeSources = await resolveOption(runtimeContext, 'includeSources', options.includeSources, true);
      const graphOptions = await resolveOption(
        runtimeContext,
        'graphOptions',
        options.graphOptions,
        defaultGraphOptions,
      );
      const databaseConfig = await resolveOption(runtimeContext, 'databaseConfig', options.databaseConfig);
      const enableFilter = await resolveOption(runtimeContext, 'enableFilter', options.enableFilter, false);

      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`);
      if (!model) throw new Error(`model is required, got: ${model}`);

      // Initialize GraphRAG with resolved options
      const resolvedGraphOptions = {
        ...defaultGraphOptions,
        ...(graphOptions || {}),
      };
      const graphRag = new GraphRAG(resolvedGraphOptions.dimension, resolvedGraphOptions.threshold);
      let isInitialized = false;

      const randomWalkSteps: number | undefined =
        runtimeContext.get('randomWalkSteps') ?? resolvedGraphOptions.randomWalkSteps;
      const restartProb: number | undefined = runtimeContext.get('restartProb') ?? resolvedGraphOptions.restartProb;
      const topK: number = runtimeContext.get('topK') ?? context.topK ?? 10;
      const filter: Record<string, any> = runtimeContext.get('filter') ?? context.filter;
      const queryText = context.queryText;

      const enableFilterValue = !!runtimeContext.get('filter') || enableFilter;

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
          return { relevantContext: [], sources: [] };
        }

        let queryFilter = {};
        if (enableFilterValue) {
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
          logger.debug('Prepared vector query parameters:', { queryFilter, topK: topKValue, databaseConfig });
        }
        const { results, queryEmbedding } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          model,
          queryFilter: Object.keys(queryFilter || {}).length > 0 ? queryFilter : undefined,
          topK: topKValue,
          includeVectors: true,
          databaseConfig,
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
          randomWalkSteps,
          restartProb,
        });
        if (logger) {
          logger.debug('GraphRAG query returned results', { count: rerankedResults.length });
        }
        // Extract and combine relevant chunks
        const relevantChunks = rerankedResults.map(result => result.content);
        if (logger) {
          logger.debug('Returning relevant context chunks', { count: relevantChunks.length });
        }
        // `sources` exposes the full retrieval objects
        const sources = includeSources ? convertToSources(rerankedResults) : [];
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

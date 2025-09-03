import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { GraphRAG } from '../graph-rag';
import { vectorQuerySearch, defaultGraphRagDescription, filterSchema, outputSchema, baseSchema } from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { GraphRagToolOptions } from './types';
import { defaultGraphOptions } from './types';

export const createGraphRAGTool = (options: GraphRagToolOptions) => {
  const { model, id, description } = options;

  const toolId = id || `GraphRAG ${options.vectorStoreName} ${options.indexName} Tool`;
  const toolDescription = description || defaultGraphRagDescription();
  const graphOptions = {
    ...defaultGraphOptions,
    ...(options.graphOptions || {}),
  };
  // Initialize GraphRAG
  const graphRag = new GraphRAG(graphOptions.dimension, graphOptions.threshold);
  let isInitialized = false;

  const inputSchema = options.enableFilter ? filterSchema : z.object(baseSchema).passthrough();

  return createTool({
    id: toolId,
    inputSchema,
    outputSchema,
    description: toolDescription,
    execute: async ({ context, mastra, runtimeContext }) => {
      const indexName: string = runtimeContext.get('indexName') ?? options.indexName;
      const vectorStoreName: string = runtimeContext.get('vectorStoreName') ?? options.vectorStoreName;
      if (!indexName) throw new Error(`indexName is required, got: ${indexName}`);
      if (!vectorStoreName) throw new Error(`vectorStoreName is required, got: ${vectorStoreName}`);
      const includeSources: boolean = runtimeContext.get('includeSources') ?? options.includeSources ?? true;
      const randomWalkSteps: number | undefined = runtimeContext.get('randomWalkSteps') ?? graphOptions.randomWalkSteps;
      const restartProb: number | undefined = runtimeContext.get('restartProb') ?? graphOptions.restartProb;
      const topK: number = runtimeContext.get('topK') ?? context.topK ?? 10;
      const filter: Record<string, any> = runtimeContext.get('filter') ?? context.filter;
      const queryText = context.queryText;
      const providerOptions: Record<string, Record<string, any>> | undefined =
        runtimeContext.get('providerOptions') ?? options.providerOptions;

      const enableFilter = !!runtimeContext.get('filter') || (options.enableFilter ?? false);

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
          providerOptions,
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

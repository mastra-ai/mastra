import type { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { GraphRAG } from '../graph-rag';
import {
  vectorQuerySearch,
  defaultGraphRagDescription,
  filterSchema,
  outputSchema,
  baseSchema,
  queryTextDescription,
} from '../utils';
import type { RagTool } from '../utils';
import { convertToSources } from '../utils/convert-sources';
import type { GraphRagToolOptions } from './types';

export const createGraphRAGTool = (options: GraphRagToolOptions) => {
  const {
    model,
    graphOptions = {
      dimension: 1536,
      randomWalkSteps: 100,
      restartProb: 0.15,
      threshold: 0.7,
    },
    id,
    description,
    useRuntimeContext,
  } = options;

  const toolId = id || `GraphRAG Tool`;
  const toolDescription = description || defaultGraphRagDescription();
  // Initialize GraphRAG
  const graphRag = new GraphRAG(graphOptions.dimension, graphOptions.threshold);
  let isInitialized = false;

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
    inputSchema,
    outputSchema,
    description: toolDescription,
    execute: async ({ context, mastra, runtimeContext }) => {
      const {
        queryText,
        topK,
        filter,
        includeSources,
        randomWalkSteps,
        restartProb,
        indexName,
        vectorStoreName,
        enableFilter,
      } = getToolParams({ runtimeContext, context, options });
      if (!indexName) {
        throw new Error('indexName is required');
      }
      if (!vectorStoreName) {
        throw new Error('vectorStoreName is required');
      }
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

function getToolParams({
  runtimeContext,
  context,
  options,
}: {
  runtimeContext: RuntimeContext;
  context: any;
  options: GraphRagToolOptions;
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
      includeSources: options.includeSources,
      randomWalkSteps: options.graphOptions?.randomWalkSteps,
      restartProb: options.graphOptions?.restartProb,
      enableFilter: options.enableFilter,
    };
  } else {
    // Get params from runtimeContext
    const { queryText } = context;
    const indexName: string = runtimeContext.get('indexName');
    const topK = runtimeContext.get('topK') ?? 10;
    const filter = runtimeContext.get('filter') ?? {};
    const vectorStoreName: string = runtimeContext.get('vectorStoreName');
    const includeSources: boolean = runtimeContext.get('includeSources') ?? true;
    const randomWalkSteps: number | undefined =
      runtimeContext.get('randomWalkSteps') ?? options.graphOptions?.randomWalkSteps;
    const restartProb: number | undefined = runtimeContext.get('restartProb') ?? options.graphOptions?.restartProb;
    return {
      indexName,
      vectorStoreName,
      queryText,
      topK,
      filter,
      includeSources,
      randomWalkSteps,
      restartProb,
      enableFilter: !!filter,
    };
  }
}

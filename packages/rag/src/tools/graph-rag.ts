import { type EmbeddingOptions } from '@mastra/core/embeddings';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { GraphRAG } from '../graph-rag';
import { vectorQuerySearch } from '../utils';

export const createGraphRAGTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
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
  options: EmbeddingOptions;
  topK?: number;
  enableFilter?: boolean;
  graphOptions?: {
    dimension?: number;
    randomWalkSteps?: number;
    restartProb?: number;
    threshold?: number;
  };
  id?: string;
  description?: string;
}) => {
  const toolId = id || `GraphRAG ${vectorStoreName} ${indexName} Tool`;
  const toolDescription =
    description ||
    `Fetches and reranks the top ${topK} relevant chunks using GraphRAG from the ${vectorStoreName} vector store using the ${indexName} index
    
    You MUST generate for each query:
    1. topK: number of results to return
       - Broad queries (overviews, lists): 10-15
       - Specific queries: 3-5

    2. filter: query filter (REQUIRED)
       - Generate a filter that matches the query's keywords and intent
       - Use appropriate operators
       - Must be valid JSON string

    User overrides:
    - If valid topK/filter provided, use those
    - If invalid/missing, you must generate appropriate values`;

  // Initialize GraphRAG
  const graphRag = new GraphRAG(graphOptions.dimension, graphOptions.threshold);
  let isInitialized = false;

  return createTool({
    id: toolId,
    inputSchema: z.object({
      queryText: z.string(),
      filter: z.string(),
    }),
    outputSchema: z.object({
      relevantContext: z.any(),
    }),
    description: toolDescription,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      if (vectorStore) {
        const queryFilter = enableFilter && filter ? filter : {};
        const { results, queryEmbedding } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          options,
          queryFilter,
          topK,
          includeVectors: true,
        });

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

          graphRag.createGraph(chunks, embeddings);
          isInitialized = true;
        }

        // Get reranked results using GraphRAG
        const rerankedResults = graphRag.query(
          queryEmbedding,
          topK,
          graphOptions.randomWalkSteps,
          graphOptions.restartProb,
        );

        // Extract and combine relevant chunks
        const relevantChunks = rerankedResults.map(result => result.content);
        return {
          relevantContext: relevantChunks,
        };
      }

      return {
        relevantContext: [],
      };
    },
  });
};

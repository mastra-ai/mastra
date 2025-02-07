import { type MastraVector, type QueryResult } from '@mastra/core/vector';
import { embed, EmbeddingModel } from 'ai';

import { getChunkText } from './get-chunk-text';

interface VectorQuerySearchParams {
  indexName: string;
  vectorStore: MastraVector;
  queryText: string;
  model: EmbeddingModel<string>;
  queryFilter?: any;
  topK: number;
  includeVectors?: boolean;
}

interface VectorQuerySearchResult {
  results: QueryResult[];
  queryEmbedding: number[];
}

// Helper function to handle vector query search
export const vectorQuerySearch = async ({
  indexName,
  vectorStore,
  queryText,
  model,
  queryFilter = {},
  topK,
  includeVectors = false,
}: VectorQuerySearchParams): Promise<VectorQuerySearchResult> => {
  const chunkText = getChunkText(queryText);
  const { embedding } = await embed({
    value: chunkText,
    model,
    maxRetries: 3,
  });
  // Get relevant chunks from the vector database
  const results = await vectorStore.query(indexName, embedding, topK, queryFilter, includeVectors);

  return { results, queryEmbedding: embedding };
};

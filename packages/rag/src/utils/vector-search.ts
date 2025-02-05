import { type EmbeddingOptions } from '@mastra/core/embeddings';
import { type MastraVector, type QueryResult } from '@mastra/core/vector';

import { embed } from '../embeddings';

interface VectorQuerySearchParams {
  indexName: string;
  vectorStore: MastraVector;
  queryText: string;
  options: EmbeddingOptions;
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
  options,
  queryFilter = {},
  topK,
  includeVectors = false,
}: VectorQuerySearchParams): Promise<VectorQuerySearchResult> => {
  const { embedding } = await embed(queryText, options);
  // Get relevant chunks from the vector database
  const results = await vectorStore.query(indexName, embedding, topK, queryFilter, includeVectors);

  return { results, queryEmbedding: embedding };
};

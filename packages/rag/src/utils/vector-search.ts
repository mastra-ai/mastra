import type { MastraVector, QueryResult } from '@mastra/core/vector';
import { embed } from 'ai';
import type { EmbeddingModel } from 'ai';

interface VectorQuerySearchParams {
  indexName: string;
  vectorStore: MastraVector;
  queryText: string;
  model: EmbeddingModel<string>;
  queryFilter?: any;
  topK: number;
  includeVectors?: boolean;
  maxRetries?: number;
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
  maxRetries = 2,
}: VectorQuerySearchParams): Promise<VectorQuerySearchResult> => {
  const { embedding } = await embed({
    value: queryText,
    model,
    maxRetries,
  });
  // Get relevant chunks from the vector database
  const results = await vectorStore.query(indexName, embedding, topK, queryFilter, includeVectors);

  return { results, queryEmbedding: embedding };
};

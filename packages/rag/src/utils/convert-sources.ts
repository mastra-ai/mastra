import type { QueryResult } from '@mastra/core';

// Utility to normalize raw vector search results into the standard QueryResult structure for sources
export const convertToSources = (results: QueryResult[]) => {
  return results.map(result => {
    return {
      id: result?.id,
      vector: result?.vector || [],
      score: result?.score,
      metadata: result?.metadata,
      document: result?.document || '',
    };
  });
};

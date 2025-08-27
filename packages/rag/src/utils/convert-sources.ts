import type { QueryResult } from '@mastra/core/vector';
import type { RankedNode } from '../graph-rag';
import type { RerankResult } from '../rerank';

type SourceInput = QueryResult | RankedNode | RerankResult;

/**
 * Convert an array of source inputs (QueryResult, RankedNode, or RerankResult) to an array of sources.
 * @param results Array of source inputs to convert.
 * @returns Array of sources.
 */
export const convertToSources = (results: SourceInput[]) => {
  return results.map(result => {
    // RankedNode
    if ('content' in result) {
      return {
        id: result.id,
        vector: result.embedding || [],
        score: result.score,
        metadata: result.metadata,
        document: result.content || '',
      };
    }
    // RerankResult
    if ('result' in result) {
      return {
        id: result.result.id,
        vector: result.result.vector || [],
        score: result.score,
        metadata: result.result.metadata,
        document: result.result.document || '',
      };
    }
    // QueryResult
    return {
      id: result.id,
      vector: result.vector || [],
      score: result.score,
      metadata: result.metadata,
      document: result.document || '',
    };
  });
};

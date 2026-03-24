import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { esClient } from '../lib/elasticsearch-client';

const MAX_RESULTS = 100;

export const executeSearch = createTool({
  id: 'execute-search',
  description: `Executes a hybrid search query against Elasticsearch using retrievers.
Combines full-text (BM25) search with semantic/vector search using RRF (Reciprocal Rank Fusion) for optimal results.

Use this tool when:
- Searching for documents by content
- Combining keyword and semantic search
- Finding relevant documents for a user query

The tool returns document IDs, scores, and source fields for citation purposes.`,
  inputSchema: z.object({
    index: z.string().describe('The index or index pattern to search (e.g., "logs-*", "products")'),
    query: z.string().describe('The search query in natural language'),
    textField: z.string().describe('The field to search for text/keyword matches (e.g., "message", "title", "content")'),
    vectorField: z
      .string()
      .optional()
      .describe('The semantic_text or dense_vector field for semantic search. If not provided, only text search is performed.'),
    size: z.number().optional().describe('Number of results to return (max 100, default: 10)'),
    filters: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe('Optional filters as field-value pairs (e.g., {"status": "active", "category": "electronics"})'),
  }),
  execute: async ({ index, query, textField, vectorField, size, filters }) => {
    const resultSize = size ?? 10;
    const limitedSize = Math.min(resultSize, MAX_RESULTS);

    const filterClauses = filters
      ? Object.entries(filters).map(([field, value]) => ({
          term: { [field]: value },
        }))
      : [];

    const searchRequest: Record<string, unknown> = {
      index,
      size: limitedSize,
    };

    if (vectorField) {
      searchRequest.retriever = {
        rrf: {
          retrievers: [
            {
              standard: {
                query: {
                  bool: {
                    must: [{ match: { [textField]: query } }],
                    ...(filterClauses.length > 0 && { filter: filterClauses }),
                  },
                },
              },
            },
            {
              standard: {
                query: {
                  bool: {
                    must: [{ semantic: { field: vectorField, query } }],
                    ...(filterClauses.length > 0 && { filter: filterClauses }),
                  },
                },
              },
            },
          ],
        },
      };
    } else {
      searchRequest.query = {
        bool: {
          must: [{ match: { [textField]: query } }],
          ...(filterClauses.length > 0 && { filter: filterClauses }),
        },
      };
    }

    const response = await esClient.search(searchRequest);

    const hits = response.hits.hits.map((hit) => ({
      _id: hit._id,
      _index: hit._index,
      _score: hit._score ?? null,
      fields: (hit._source as Record<string, unknown>) || {},
    }));

    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value ?? 0;

    return {
      hits,
      total,
      took: response.took,
    };
  },
});

import { EmbeddingOptions } from '@mastra/core/embeddings';
import { createTool } from '@mastra/core/tools';
import { MastraVector, QueryResult } from '@mastra/core/vector';
import { z } from 'zod';

import { ChunkParams, MDocument } from '../document';
import { embed } from '../embeddings';

import { GraphRAG } from './graph-rag';
import { rerank, RerankConfig } from './rerank';

type VectorFilterType = 'pg' | 'astra' | 'qdrant' | 'upstash' | 'pinecone' | 'chroma' | '';

const createFilter = (filter: any, vectorFilterType: VectorFilterType) => {
  if (['pg', 'astra', 'pinecone'].includes(vectorFilterType)) {
    if ('type' in filter) {
      return {
        [filter.type]: filter.filters.map((f: any) => createFilter(f, vectorFilterType)),
      };
    }

    const { keyword, operator, value } = filter;
    return { [keyword]: { [operator]: value } };
  } else if (vectorFilterType === 'chroma') {
    return { [filter.keyword]: filter.value };
  } else if (vectorFilterType === 'qdrant') {
    return {
      must: [
        {
          key: filter.keyword,
          match: {
            value: filter.value,
          },
        },
      ],
    };
  } else {
    return { filter };
  }
};

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
const vectorQuerySearch = async ({
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

const BasicFilter = z.object({
  keyword: z.string(),
  operator: z.string(),
  value: z.string(),
});

const LogicalFilter = z.object({
  type: z.enum(['$and', '$or']),
  filters: z.array(BasicFilter),
});

const filter = z.union([BasicFilter, LogicalFilter]);

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
  vectorFilterType = '',
  reranker,
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  topK?: number;
  vectorFilterType?: VectorFilterType;
  reranker?: RerankConfig;
}) => {
  return createTool({
    id: `VectorQuery ${vectorStoreName} ${indexName} Tool`,
    inputSchema: z.object({
      queryText: z.string(),
      filter,
    }),
    outputSchema: z.object({
      relevantContext: z.string(),
    }),
    description: `Fetches and combines the top ${topK} relevant chunks from the ${vectorStoreName} vector store using the ${indexName} index`,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      let relevantContext = '';
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      // Get relevant chunks from the vector database
      if (vectorStore) {
        const queryFilter = vectorFilterType && filter ? createFilter(filter, vectorFilterType) : {};
        const { results } = await vectorQuerySearch({
          indexName,
          vectorStore,
          queryText,
          options,
          queryFilter,
          topK,
        });
        if (reranker) {
          const rerankedResults = await rerank(results, queryText, reranker.model, {
            ...reranker.options,
            topK: reranker.options?.topK || topK,
          });
          const relevantChunks = rerankedResults.map(({ result }) => result?.metadata?.text);
          relevantContext = relevantChunks.join('\n\n');
          return { relevantContext };
        }

        const relevantChunks = results.map(result => result?.metadata?.text);

        // Combine the chunks into a context string
        relevantContext = relevantChunks.join('\n\n');
      }

      return {
        relevantContext,
      };
    },
  });
};

export const createGraphRAGTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
  vectorFilterType = '',
  graphOptions = {
    dimension: 1536,
    randomWalkSteps: 100,
    restartProb: 0.15,
    threshold: 0.7,
  },
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  topK?: number;
  vectorFilterType?: VectorFilterType;
  graphOptions?: {
    dimension?: number;
    randomWalkSteps?: number;
    restartProb?: number;
    threshold?: number;
  };
}) => {
  // Initialize GraphRAG
  const graphRag = new GraphRAG(graphOptions.dimension, graphOptions.threshold);
  let isInitialized = false;

  return createTool({
    id: `GraphRAG ${vectorStoreName} ${indexName} Tool`,
    inputSchema: z.object({
      queryText: z.string(),
      filter: z.object({
        keyword: z.string(),
        operator: z.string(),
        value: z.string(),
      }),
    }),
    outputSchema: z.object({
      relevantContext: z.string(),
    }),
    description: `Fetches and reranks the top ${topK} relevant chunks using GraphRAG from the ${vectorStoreName} vector store using the ${indexName} index`,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      let relevantContext = '';
      const vectorStore = mastra?.vectors?.[vectorStoreName];

      if (vectorStore) {
        const queryFilter = vectorFilterType && filter ? createFilter(filter, vectorFilterType) : {};
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
        relevantContext = relevantChunks.join('\n\n');
      }

      return {
        relevantContext,
      };
    },
  });
};

export const createDocumentChunkerTool = ({
  doc,
  params = {
    strategy: 'recursive',
    size: 512,
    overlap: 50,
    separator: '\n',
  },
}: {
  doc: MDocument;
  params?: ChunkParams;
}) => {
  return createTool({
    id: `Document Chunker ${params.strategy} ${params.size}`,
    inputSchema: z.object({}),
    description: `Chunks document using ${params.strategy} strategy with size ${params.size} and ${params.overlap} overlap`,
    execute: async () => {
      const chunks = await doc.chunk(params);

      return {
        chunks,
      };
    },
  });
};

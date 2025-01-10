import { createTool, EmbeddingOptions, EmbedResult } from '@mastra/core';
import { z } from 'zod';

import { ChunkParams, MDocument } from '../document';
import { embed } from '../embeddings';

type VectorFilterType = 'pg' | 'astra' | 'qdrant' | 'upstash' | 'pinecone' | 'chroma' | '';

const createFilter = (filter: any, vectorFilterType: VectorFilterType) => {
  if (['pg', 'astra', 'pinecone'].includes(vectorFilterType)) {
    return { [filter.keyword]: { [filter.operator]: filter.value } };
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

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
  vectorFilterType = '',
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  topK?: number;
  vectorFilterType?: VectorFilterType;
}) => {
  return createTool({
    id: `VectorQuery ${vectorStoreName} ${indexName} Tool`,
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
    description: `Fetches and combines the top ${topK} relevant chunks from the ${vectorStoreName} vector store using the ${indexName} index`,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      let relevantContext = '';
      const vectorStore = mastra?.vectors?.[vectorStoreName];
      const { embedding } = (await embed(queryText, options)) as EmbedResult<string>;

      // Get relevant chunks from the vector database
      if (vectorStore) {
        const queryFilter = vectorFilterType && filter ? createFilter(filter, vectorFilterType) : {};
        const results = await vectorStore.query(indexName, embedding, topK, queryFilter);
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

export const createDocumentChunker = ({
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

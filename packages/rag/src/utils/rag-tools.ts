import { createTool, EmbeddingOptions, EmbedResult } from '@mastra/core';
import { z } from 'zod';

import { ChunkParams, MDocument } from '../document';
import { embed } from '../embeddings';

export const createVectorQueryTool = ({
  vectorStoreName,
  indexName,
  topK = 10,
  options,
  useFilter = false,
}: {
  vectorStoreName: string;
  indexName: string;
  options: EmbeddingOptions;
  topK?: number;
  useFilter: boolean;
}) => {
  return createTool({
    id: `VectorQuery ${vectorStoreName} ${indexName} Tool`,
    inputSchema: z.object({
      queryText: z.string(),
      filter: z
        .object({
          keyword: z.string().min(1),
          operator: z.string().min(1),
          value: z.string().min(1),
        })
        .optional(),
    }),
    outputSchema: z.object({
      context: z.string(),
    }),
    description: `Fetches and combines the top ${topK} relevant chunks from the ${vectorStoreName} vector store using the ${indexName} index`,
    execute: async ({ context: { queryText, filter }, mastra }) => {
      let context = '';
      const vectorStore = mastra?.vectors?.[vectorStoreName];
      console.log({ vectorStore, vectorStoreName });
      const { embedding } = (await embed(queryText, options)) as EmbedResult<string>;

      // Get relevant chunks from the vector database
      if (vectorStore) {
        const queryFilter = useFilter && filter ? { [filter.keyword]: { [filter.operator]: filter.value } } : {};
        const results = await vectorStore.query(indexName, embedding, topK, queryFilter);
        const relevantChunks = results.map(result => result?.metadata?.text);

        // Combine the chunks into a context string
        context = relevantChunks.join('\n\n');
      }

      return {
        context,
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

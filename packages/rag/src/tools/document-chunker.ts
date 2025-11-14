import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MDocument, ChunkParams } from '../document';

const DEFAULT_CHUNK_PARAMS = {
  strategy: 'recursive' as const,
  maxSize: 512,
  overlap: 50,
  separators: ['\n'],
} satisfies ChunkParams;

export const createDocumentChunkerTool = ({
  doc,
  params = DEFAULT_CHUNK_PARAMS,
}: {
  doc: MDocument;
  params?: ChunkParams;
}): ReturnType<typeof createTool> => {
  return createTool({
    id: `Document Chunker ${params.strategy} ${params.maxSize}`,
    inputSchema: z.object({}),
    description: `Chunks document using ${params.strategy} strategy with maxSize ${params.maxSize} and ${
      params.overlap || 0
    } overlap`,
    execute: async () => {
      const chunks = await doc.chunk(params);

      return {
        chunks,
      };
    },
  });
};

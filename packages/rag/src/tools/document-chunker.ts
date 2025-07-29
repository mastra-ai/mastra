import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MDocument, ChunkParams } from '../document';

export const createDocumentChunkerTool = ({
  doc,
  params = {
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
    separators: ['\n'],
  } as ChunkParams,
}: {
  doc: MDocument;
  params?: ChunkParams;
}): ReturnType<typeof createTool> => {
  const maxSize = 'maxSize' in params ? params.maxSize : 512;

  return createTool({
    id: `Document Chunker ${params.strategy} ${maxSize}`,
    inputSchema: z.object({}),
    description: `Chunks document using ${params.strategy} strategy with maxSize ${maxSize} and ${params.overlap || 0} overlap`,
    execute: async () => {
      const chunks = await doc.chunk(params);

      return {
        chunks,
      };
    },
  });
};

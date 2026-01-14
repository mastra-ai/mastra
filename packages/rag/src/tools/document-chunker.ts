import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { MDocument, ChunkParams } from '../document';

const DEFAULT_CHUNK_PARAMS = {
  strategy: 'recursive' as const,
  maxSize: 512,
  overlap: 50,
  recursiveOptions: {
    separators: ['\n'],
  },
} satisfies ChunkParams;

export const createDocumentChunkerTool = ({
  doc,
  params = DEFAULT_CHUNK_PARAMS,
}: {
  doc: MDocument;
  params?: ChunkParams;
}) => {
  const maxSize = (params as any).maxSize || (params as any).sentenceOptions?.maxSize;
  const overlap = (params as any).overlap || 0;

  return createTool({
    id: `Document Chunker ${params.strategy} ${maxSize}`,
    inputSchema: z.object({}),
    description: `Chunks document using ${params.strategy} strategy with maxSize ${maxSize} and ${overlap} overlap`,
    execute: async () => {
      const chunks = await doc.chunk(params);

      return {
        chunks,
      };
    },
  });
};

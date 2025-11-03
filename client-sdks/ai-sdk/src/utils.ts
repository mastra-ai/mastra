import type { DataChunkType } from '@mastra/core/stream';

export const isDataChunkType = (chunk: any): chunk is DataChunkType => {
  return chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type?.startsWith('data-');
};

export const safeParseErrorObject = (obj: unknown): string => {
  if (obj && typeof obj === 'object' && 'message' in obj && typeof obj.message === 'string') {
    return obj.message;
  }
  return String(obj);
};

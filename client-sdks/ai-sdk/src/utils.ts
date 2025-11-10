import type { DataChunkType, NetworkChunkType } from '@mastra/core/stream';

export const isDataChunkType = (chunk: any): chunk is DataChunkType => {
  return chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type?.startsWith('data-');
};

export function safeParseErrorObject(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }

  try {
    const stringified = JSON.stringify(obj);
    // If JSON.stringify returns "{}", fall back to String() for better representation
    if (stringified === '{}') {
      return String(obj);
    }
    return stringified;
  } catch {
    // Fallback to String() if JSON.stringify fails (e.g., circular references)
    return String(obj);
  }
}

export const isAgentExecutionDataChunkType = (
  chunk: any,
): chunk is Omit<NetworkChunkType, 'payload'> & { payload: DataChunkType } => {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'type' in chunk &&
    chunk.type?.startsWith('agent-execution-event-') &&
    'payload' in chunk &&
    typeof chunk.payload === 'object' &&
    'type' in chunk.payload &&
    chunk.payload.type?.startsWith('data-')
  );
};

export const isWorkflowExecutionDataChunkType = (
  chunk: any,
): chunk is Omit<NetworkChunkType, 'payload'> & { payload: DataChunkType } => {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'type' in chunk &&
    chunk.type?.startsWith('workflow-execution-event-') &&
    'payload' in chunk &&
    typeof chunk.payload === 'object' &&
    'type' in chunk.payload &&
    chunk.payload.type?.startsWith('data-')
  );
};

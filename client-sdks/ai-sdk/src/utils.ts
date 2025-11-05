import type { DataChunkType, NetworkChunkType } from '@mastra/core/stream';

export const isDataChunkType = (chunk: any): chunk is DataChunkType => {
  return chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type?.startsWith('data-');
};

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

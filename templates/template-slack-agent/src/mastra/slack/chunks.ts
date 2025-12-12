import type { ChunkType } from '@mastra/core/stream';
import type { StreamState } from './types.js';
import { formatName } from './utils.js';

/**
 * Handle nested events that use template literal types.
 * These can't be directly matched in switch because they're typed as
 * `agent-execution-event-${string}` and `workflow-execution-event-${string}`
 */
export function handleNestedChunkEvents(chunk: ChunkType, state: StreamState): void {
  // Guard: some chunk types (like "object") don't have payload
  if (!('payload' in chunk)) return;

  // Agent execution nested events (e.g., "agent-execution-event-text-delta")
  if (chunk.type.startsWith('agent-execution-event-')) {
    const innerChunk = chunk.payload;
    if (innerChunk && typeof innerChunk === 'object' && 'type' in innerChunk && innerChunk.type === 'text-delta') {
      const payload = (innerChunk as { payload?: { text?: string } }).payload;
      if (payload?.text) {
        state.text += payload.text;
        state.chunkType = 'text-delta';
      }
    }
    return;
  }

  // Workflow execution nested events (e.g., "workflow-execution-event-workflow-step-start")
  if (chunk.type.startsWith('workflow-execution-event-')) {
    const innerChunk = chunk.payload;
    if (
      innerChunk &&
      typeof innerChunk === 'object' &&
      'type' in innerChunk &&
      innerChunk.type === 'workflow-step-start'
    ) {
      const payload = (innerChunk as { payload?: { id?: string } }).payload;
      state.chunkType = 'workflow-step-start';
      state.stepName = formatName(payload?.id ?? 'step');
    }
  }
}

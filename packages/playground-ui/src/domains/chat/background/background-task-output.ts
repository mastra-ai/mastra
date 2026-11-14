import type { BackgroundTaskOutputChunk } from '@mastra/react/hooks/agents';
import { isRecord } from '../messages/signal-data';

/** A streamed chunk's text, from a nested agent's `text-delta` in either chunk shape. */
function chunkText(chunk: unknown): string {
  if (!isRecord(chunk) || chunk.type !== 'text-delta') return '';
  if (typeof chunk.text === 'string') return chunk.text;
  return isRecord(chunk.payload) && typeof chunk.payload.text === 'string' ? chunk.payload.text : '';
}

/** The text a running task streamed: its tool output wraps each chunk the task's agent or workflow emitted. */
export function backgroundTaskOutputText(output: readonly BackgroundTaskOutputChunk[] | undefined): string {
  return (output ?? []).map(chunk => chunkText(isRecord(chunk.payload) ? chunk.payload.output : undefined)).join('');
}

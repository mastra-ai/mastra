import { ChunkFrom } from '../stream/types';
import type { DataChunkType, WorkflowStreamEvent } from '../stream/types';

export type StreamChunkWriter = {
  write: (chunk: unknown) => Promise<void>;
};

export async function forwardAgentStreamChunk({
  writer,
  chunk,
}: {
  writer?: StreamChunkWriter;
  chunk: unknown;
}): Promise<void> {
  if (!writer) {
    return;
  }

  await writer.write(chunk);
}

export function toWorkflowStreamEvent(event: WorkflowStreamEvent | DataChunkType, runId: string): WorkflowStreamEvent {
  const from = 'from' in event && event.from ? event.from : ChunkFrom.WORKFLOW;

  if (!('payload' in event)) {
    return { ...event, runId, from };
  }

  const { type, payload } = event;
  const stepName = 'id' in payload ? payload.id : undefined;
  // `type` and `payload` stay paired at runtime; TypeScript loses that pairing once they are destructured.
  return { type, runId, from, payload: { stepName, ...payload } } as WorkflowStreamEvent;
}

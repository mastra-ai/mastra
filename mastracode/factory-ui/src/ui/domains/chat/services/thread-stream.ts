import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import type { ChunkType } from '@mastra/core/stream';
import { accumulateChunk } from '@mastra/react';

import { isRecord } from '../../../../lib/isRecord';

function signalCreatedAt(signal: unknown): Date {
  if (isRecord(signal) && typeof signal.createdAt === 'string' && Number.isFinite(Date.parse(signal.createdAt))) {
    return new Date(signal.createdAt);
  }
  return new Date();
}

export function createThreadStreamHandler(onEvent: (event: AgentControllerEvent) => void) {
  let messages: MastraDBMessage[] = [];
  let receivingChunks = false;

  return {
    onEvent(event: AgentControllerEvent) {
      const messageEvent =
        event.type === 'message_start' || event.type === 'message_update' || event.type === 'message_end';
      if (receivingChunks && messageEvent) return;
      if (event.type === 'thread_changed') messages = [];
      onEvent(event);
    },
    reset() {
      messages = [];
      receivingChunks = false;
    },
    onChunk(chunk: ChunkType) {
      receivingChunks = true;
      if (chunk.type === 'start') {
        messages = [];
      }
      if (
        (chunk.type === 'data-user-message' || chunk.type === 'data-signal' || chunk.type === 'data-system-reminder') &&
        'data' in chunk &&
        isRecord(chunk.data) &&
        typeof chunk.data.id === 'string'
      ) {
        const signals: MastraDBMessage[] =
          chunk.type === 'data-user-message'
            ? accumulateChunk({ chunk, conversation: [], metadata: { mode: 'stream' } })
            : [
                {
                  id: chunk.data.id,
                  role: 'signal',
                  createdAt: signalCreatedAt(chunk.data),
                  content: { format: 2, parts: [{ type: chunk.type, data: chunk.data }] },
                },
              ];
        for (const message of signals) {
          onEvent({
            type: 'message_end',
            message: {
              ...message,
              role: 'signal',
              createdAt: signalCreatedAt(chunk.data),
              content: { ...message.content, metadata: { ...message.content.metadata, signal: chunk.data } },
            },
          });
        }
        return;
      }

      const previousMessages = messages;
      messages = accumulateChunk({ chunk, conversation: messages, metadata: { mode: 'stream' } });
      const finished = chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error';
      for (const [index, message] of messages.entries()) {
        if (message === previousMessages[index]) continue;
        if (message.role === 'assistant' && message.content.parts.every(part => part.type.startsWith('data-'))) {
          continue;
        }
        const streaming = !finished && message.role === 'assistant' && index === messages.length - 1;
        onEvent({ type: streaming ? 'message_update' : 'message_end', message });
      }
    },
  };
}

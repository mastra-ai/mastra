import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import type { ChunkType } from '@mastra/core/stream';
import { accumulateChunk } from '@mastra/react';
import type { MastraDBMessageMetadata } from '@mastra/react';

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
      const previousMessages = messages;
      if (
        (chunk.type === 'data-signal' || chunk.type === 'data-system-reminder') &&
        'data' in chunk &&
        isRecord(chunk.data) &&
        typeof chunk.data.id === 'string'
      ) {
        onEvent({
          type: 'message_end',
          message: {
            id: chunk.data.id,
            role: 'signal',
            createdAt: signalCreatedAt(chunk.data),
            content: { format: 2, parts: [{ type: chunk.type, data: chunk.data }], metadata: { signal: chunk.data } },
          },
        });
        return;
      }

      messages = accumulateChunk({ chunk, conversation: messages, metadata: { mode: 'stream' } });
      const userSignal = chunk.type === 'data-user-message' && 'data' in chunk ? chunk.data : undefined;
      const finished = chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error';
      messages = messages.map((message, index) => {
        if (message === previousMessages[index]) return message;
        if (message.role === 'user' && userSignal) {
          message = {
            ...message,
            role: 'signal',
            createdAt: signalCreatedAt(userSignal),
            content: { ...message.content, metadata: { ...message.content.metadata, signal: userSignal } },
          };
        }
        if (message.role === 'assistant' && message.content.parts.every(part => part.type.startsWith('data-'))) {
          return message;
        }
        const streaming = !finished && message.role === 'assistant' && index === messages.length - 1;
        onEvent({ type: streaming ? 'message_update' : 'message_end', message });
        return message;
      });

      const metadata: MastraDBMessageMetadata = messages.at(-1)?.content.metadata ?? {};
      switch (chunk.type) {
        case 'tool-call-approval': {
          const approval = metadata.requireApprovalMetadata?.[chunk.payload.toolName];
          if (approval) onEvent({ type: 'tool_approval_required', ...approval });
          break;
        }
        case 'tool-call-suspended': {
          const suspension = metadata.suspendedTools?.[chunk.payload.toolName];
          if (suspension) onEvent({ type: 'tool_suspended', ...suspension });
          break;
        }
      }
    },
  };
}

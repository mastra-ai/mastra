import type { MastraDBMessage, MessageList } from '../agent/message-list';
import { isDataChunk } from '../stream/types';
import { deepEqual } from '../utils/deep-equal';
import type { ProcessorStreamWriter } from './index';

/**
 * Persist a non-transient `data-*` chunk emitted by an output processor's
 * `writer.custom()` onto the assistant message, so the chunk survives in
 * thread history instead of being stream-only (#19375). Transient chunks
 * and non-data chunks are left untouched.
 *
 * Used by the stream output and by the durable engine, whose producer-side
 * processor writers persist into the workflow-side MessageList (the one
 * serialized into `messageListState` and flushed to memory at finalize).
 */
export function persistProcessorDataChunk(
  messageList: MessageList,
  messageId: string,
  chunk: { type: string; data?: unknown; transient?: boolean },
): void {
  if (!isDataChunk(chunk) || chunk.transient) return;

  const message: MastraDBMessage = {
    id: messageId,
    role: 'assistant',
    content: {
      format: 2,
      parts: [{ type: chunk.type as `data-${string}`, data: chunk.data }],
    },
    createdAt: new Date(),
  };
  messageList.add(message, 'response');
}

type PersistedDataChunk = { type: `data-${string}`; data?: unknown };

// Matches the part the writer merged by reference; for object data this rules out equal parts from earlier turns.
function holdsDataPart(message: MastraDBMessage, chunk: PersistedDataChunk): boolean {
  return message.content.parts.some(
    part => part.type === chunk.type && (part as { data?: unknown }).data === chunk.data,
  );
}

// Matches by value, so a part the processor kept in a cloned message counts as already present.
function hasEqualDataPart(message: MastraDBMessage, chunk: PersistedDataChunk): boolean {
  return message.content.parts.some(
    part => part.type === chunk.type && deepEqual((part as { data?: unknown }).data, chunk.data),
  );
}

/**
 * Tracks the persistent `data-*` chunks a processor writes during one call so they
 * survive when the processor returns replacement messages (#29822).
 *
 * The writer persists each chunk by merging it into the stored assistant message.
 * A returned message array replaces stored messages wholesale, so a copy the
 * processor took before writing would drop the merged part. `captureHolders` notes
 * which message holds each part before the replacement, and `restore` re-merges any
 * part that the replacement removed.
 */
export function trackProcessorDataWrites(writer: ProcessorStreamWriter | undefined) {
  const written: PersistedDataChunk[] = [];
  let holders: Array<{ chunk: PersistedDataChunk; messageId: string }> = [];

  const trackedWriter: ProcessorStreamWriter | undefined = writer && {
    custom: async (data, options) => {
      const chunk = data as { type: string; data?: unknown; transient?: boolean };
      if (isDataChunk(chunk) && !chunk.transient) {
        written.push(chunk);
      }
      return writer.custom(data, options);
    },
  };

  return {
    writer: trackedWriter,
    captureHolders(messageList: MessageList) {
      if (written.length === 0) return;
      const messages = messageList.get.all.db();
      holders = [];
      for (const chunk of written) {
        // Newest first: the writer merges into the current response message, and primitive
        // data (strings, numbers, undefined) can also match an equal part from an earlier turn.
        const holder = messages.findLast(message => holdsDataPart(message, chunk));
        if (holder) holders.push({ chunk, messageId: holder.id });
      }
    },
    restore(messageList: MessageList) {
      if (holders.length === 0) return;
      const messages = messageList.get.all.db();
      for (const { chunk, messageId } of holders) {
        const holder = messages.find(message => message.id === messageId);
        if (holder && !hasEqualDataPart(holder, chunk)) {
          persistProcessorDataChunk(messageList, messageId, chunk);
        }
      }
    },
  };
}

export type ProcessorDataWrites = ReturnType<typeof trackProcessorDataWrites>;

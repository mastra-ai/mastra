import type { MastraDBMessage } from '../../memory/types';
import { CacheKeyGenerator } from './cache/CacheKeyGenerator';
import type { MessageList } from './message-list';

type DBPart = MastraDBMessage['content']['parts'][number];

/** A `data-*` part as a copy preserves it: its key (type and id) and its content. */
export type DataPartRecord = { key: string; content: string; part: DBPart };

export type ProcessorCallRecord = {
  /** The `data-*` parts each assistant message held when the call started, keyed by message id. */
  before: Map<string, DataPartRecord[]>;
  /** The `data-*` parts `writer.custom()` merged into each message during the call, in write order. */
  written: () => Map<string, DataPartRecord[]>;
};

const writeLogs = new WeakMap<MessageList, { messageId: string; part: DataPartRecord }[]>();
const calls = new WeakMap<object, ProcessorCallRecord>();

export function recordDataPart(part: DBPart): DataPartRecord {
  return {
    key: `${part.type}|${JSON.stringify('id' in part ? (part.id ?? null) : null)}`,
    content: CacheKeyGenerator.fromDBParts([part]),
    part,
  };
}

/**
 * Adds a writer's `data-*` part message to the list and records the parts the merge added, so the runner can
 * tell a processor's writes from the parts its returned copy carries. The part is recorded against the message
 * that received it, which can be a different message from `message.id` when the add merges into the latest one.
 */
export function addWriterDataPart(messageList: MessageList, message: MastraDBMessage): void {
  const partsBefore = new Set(messageList.get.all.db().flatMap(m => m.content.parts));
  messageList.add(message, 'response');
  let log = writeLogs.get(messageList);
  if (!log) writeLogs.set(messageList, (log = []));
  for (const received of messageList.get.all.db()) {
    for (const part of received.content.parts) {
      if (part.type.startsWith('data-') && !partsBefore.has(part)) {
        log.push({ messageId: received.id, part: recordDataPart(structuredClone(part)) });
      }
    }
  }
}

/** Starts recording a processor call against `token` (the call's message source checker). */
export function startProcessorCall(messageList: MessageList, token: object, messages: MastraDBMessage[]): void {
  const start = writeLogs.get(messageList)?.length ?? 0;
  const before = new Map(
    messages
      .filter(message => message.role === 'assistant')
      .map(message => [
        message.id,
        message.content.parts.filter(part => part.type.startsWith('data-')).map(recordDataPart),
      ]),
  );
  calls.set(token, {
    before,
    written: () => {
      const written = new Map<string, DataPartRecord[]>();
      for (const { messageId, part } of writeLogs.get(messageList)?.slice(start) ?? []) {
        written.set(messageId, [...(written.get(messageId) ?? []), part]);
      }
      return written;
    },
  });
}

export function getProcessorCall(token: object): ProcessorCallRecord | undefined {
  return calls.get(token);
}

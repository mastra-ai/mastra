import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfigInternal } from '../../memory/types';
import { isProcessorWorkflow } from '../../processors/is-processor-workflow';
import type { MemoryStorage } from '../../storage';
import type { MastraDBMessage, MessageList } from '../message-list';
import type { SaveQueueManager } from './index';

/**
 * Storages owned by the MessageHistory processors in a resolved processor list.
 *
 * A run without a Memory instance saves through those processors, so they are the only handle on
 * the storage a tripwire has to undo. Resolved lists hold combined processor workflows, which carry
 * the processors they wrap on `__processors`; raw processors reach us directly.
 */
export function collectMessageHistoryStorages(processors: unknown[]): MemoryStorage[] {
  const storages = new Set<MemoryStorage>();

  const visit = (entry: unknown) => {
    if (!entry || typeof entry !== 'object') return;

    const wrapped = (entry as { __processors?: unknown[] }).__processors;
    if (Array.isArray(wrapped)) {
      for (const inner of wrapped) visit(inner);
      return;
    }

    if (isProcessorWorkflow(entry)) return;

    const processor = entry as { id?: unknown; getStorage?: () => MemoryStorage };
    if (processor.id !== 'message-history' || typeof processor.getStorage !== 'function') return;
    storages.add(processor.getStorage());
  };

  for (const processor of processors) visit(processor);
  return [...storages];
}

/**
 * A processOutputResult tripwire skips the run-level save, but response messages may already
 * be stored: flushed before a tool-approval suspension, or per step with savePerStep. Undo
 * those writes so a blocked reply never reaches the thread (and the model on the next turn).
 * Messages that arrived from memory or as input (e.g. a client re-sending an earlier assistant
 * message with a tool result) belong to earlier turns and are never deleted. New output can
 * merge into such a message, so a stored copy that changed during this run is put back to
 * `earlierTurnSnapshot`, the content it had when the run started. Only ids actually found in
 * storage are touched, so runs that saved nothing early never write.
 */
export async function undoSavedResponseMessages({
  memory,
  storages,
  threadId,
  memoryConfig,
  messageList,
  saveQueueManager,
  earlierTurnSnapshot,
  logger,
  runId,
}: {
  memory: MastraMemory | undefined;
  /** Storages of the configured MessageHistory processors, used when there is no Memory instance. */
  storages?: MemoryStorage[];
  threadId: string | undefined;
  memoryConfig: MemoryConfigInternal | undefined;
  messageList: MessageList;
  saveQueueManager: SaveQueueManager | undefined;
  earlierTurnSnapshot?: MastraDBMessage;
  logger: IMastraLogger;
  runId: string;
}) {
  if ((!memory && !storages?.length) || !threadId || memoryConfig?.readOnly) return;

  const earlierTurnIds = messageList.getRememberedAndInputMessageIds();
  const candidateIds = messageList.getPersisted.response.db().map(message => message.id);
  if (candidateIds.length === 0) return;

  try {
    await saveQueueManager?.flushPending(threadId);

    // A Memory instance owns the store the run saved through. Without one, the storage came from the
    // MessageHistory processors, and every one of them has to be searched: only ids found there are
    // touched, so extra storages are harmless.
    let stores: MemoryStorage[];
    if (memory) {
      const memoryStore = await memory.storage.getStore('memory');
      if (!memoryStore) return;
      stores = [memoryStore];
    } else {
      stores = storages ?? [];
    }

    for (const store of stores) {
      const { messages: stored } = await store.listMessagesById({ messageIds: candidateIds });
      const storedInThread = stored.filter(message => message.threadId === threadId);
      if (storedInThread.length === 0) continue;

      const idsToDelete = storedInThread.filter(message => !earlierTurnIds.has(message.id)).map(message => message.id);
      if (idsToDelete.length > 0) {
        if (memory) await memory.deleteMessages(idsToDelete);
        else await store.deleteMessages(idsToDelete);
      }

      const storedEarlierTurn = storedInThread.find(
        message => message.id === earlierTurnSnapshot?.id && earlierTurnIds.has(message.id),
      );
      if (
        earlierTurnSnapshot &&
        storedEarlierTurn &&
        JSON.stringify(storedEarlierTurn.content.parts) !== JSON.stringify(earlierTurnSnapshot.content.parts)
      ) {
        if (memory) await memory.saveMessages({ messages: [earlierTurnSnapshot], memoryConfig });
        else await store.saveMessages({ messages: [earlierTurnSnapshot] });
      }
    }
  } catch (error) {
    logger.error('Failed to remove saved messages after an output processor tripwire', { error, runId, threadId });
  }
}

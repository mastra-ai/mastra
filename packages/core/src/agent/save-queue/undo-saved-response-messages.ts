import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory/memory';
import type { MemoryConfigInternal } from '../../memory/types';
import type { MastraDBMessage, MessageList } from '../message-list';
import type { SaveQueueManager } from './index';

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
  threadId,
  memoryConfig,
  messageList,
  saveQueueManager,
  earlierTurnSnapshot,
  logger,
  runId,
}: {
  memory: MastraMemory | undefined;
  threadId: string | undefined;
  memoryConfig: MemoryConfigInternal | undefined;
  messageList: MessageList;
  saveQueueManager: SaveQueueManager | undefined;
  earlierTurnSnapshot?: MastraDBMessage;
  logger: IMastraLogger;
  runId: string;
}) {
  if (!memory || !threadId || memoryConfig?.readOnly) return;

  const earlierTurnIds = messageList.getRememberedAndInputMessageIds();
  const candidateIds = messageList.getPersisted.response.db().map(message => message.id);
  if (candidateIds.length === 0) return;

  try {
    await saveQueueManager?.flushPending(threadId);
    const memoryStore = await memory.storage.getStore('memory');
    if (!memoryStore) return;
    const { messages: stored } = await memoryStore.listMessagesById({ messageIds: candidateIds });
    const storedInThread = stored.filter(message => message.threadId === threadId);

    const idsToDelete = storedInThread.filter(message => !earlierTurnIds.has(message.id)).map(message => message.id);
    const storedEarlierTurn = storedInThread.find(
      message => message.id === earlierTurnSnapshot?.id && earlierTurnIds.has(message.id),
    );

    if (idsToDelete.length > 0) await memory.deleteMessages(idsToDelete);
    if (
      earlierTurnSnapshot &&
      storedEarlierTurn &&
      JSON.stringify(storedEarlierTurn.content.parts) !== JSON.stringify(earlierTurnSnapshot.content.parts)
    ) {
      await memory.saveMessages({ messages: [earlierTurnSnapshot], memoryConfig });
    }
  } catch (error) {
    logger.error('Failed to remove saved messages after an output processor tripwire', { error, runId, threadId });
  }
}

import type { MessageList } from '../../agent/message-list';
import { withUnavailableAttachmentUrls } from '../../agent/message-list/prompt/unavailable-attachments';
import type { IMastraLogger } from '../../logger';
import type { MastraMemory } from '../../memory';

/**
 * Persists the attachments a prompt build found unavailable onto their stored user
 * messages, so later turns render the same placeholder without fetching them again.
 *
 * The record is merged onto the freshly loaded row, so its parts and other metadata
 * (e.g. OM seal markers) are kept. Messages not stored yet
 * already carry the record in memory and are saved with it. Best effort: a failure
 * only means the next turn tries the download once more.
 */
export async function persistUnavailableAttachments({
  messageList,
  memory,
  readOnly,
  logger,
}: {
  messageList: MessageList;
  memory?: MastraMemory;
  readOnly?: boolean;
  logger?: IMastraLogger;
}) {
  const updates = messageList.drainUnavailableAttachmentUpdates();
  if (updates.length === 0 || !memory || readOnly) return;

  try {
    const memoryStore = await memory.storage.getStore('memory');
    if (!memoryStore) return;

    const urlsById = new Map(updates.map(update => [update.messageId, update.urls]));
    const { messages } = await memoryStore.listMessagesById({ messageIds: [...urlsById.keys()] });
    const changed = messages.map(message => ({
      id: message.id,
      content: {
        ...message.content,
        metadata: withUnavailableAttachmentUrls(message.content.metadata, urlsById.get(message.id) ?? []),
      },
    }));
    if (changed.length > 0) {
      await memoryStore.updateMessages({ messages: changed });
    }
  } catch (error) {
    logger?.warn('Could not record unavailable attachments on stored messages', { error });
  }
}
